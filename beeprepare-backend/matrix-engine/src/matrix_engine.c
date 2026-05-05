#include "matrix_types.h"
#include "trie.h"
#include "heap.h"
#include "bitmask.h"
#include "shuffle.h"
#include "tag_quota.h"
#include "knapsack.h"
#include <emscripten/emscripten.h>
#include <stdio.h>
#include <string.h>
#include <time.h>

static QuestionBank g_bank;
static TrieNode*    g_chapter_trie = NULL;
static uint32_t     g_current_time = 0;

EMSCRIPTEN_KEEPALIVE
int engine_load(
  uint32_t* ids,        uint8_t* marks,       uint8_t* difficulty,
  uint8_t*  importance, uint8_t* frequency,   uint32_t* timestamps,
  uint64_t* subtopics,  uint8_t* meta_tags,   uint8_t* chapter_idxs,
  uint8_t*  types,      uint32_t count,      uint32_t current_time
) {
    g_bank.count = count;
    for (uint32_t i = 0; i < count; i++) {
        g_bank.pool[i].id             = ids[i];
        g_bank.pool[i].marks          = marks[i];
        g_bank.pool[i].difficulty     = difficulty[i];
        g_bank.pool[i].importance     = importance[i];
        g_bank.pool[i].exam_frequency = frequency[i];
        g_bank.pool[i].last_used_ts   = timestamps[i];
        g_bank.pool[i].subtopic_bits  = subtopics[i];
        g_bank.pool[i].meta_tag_bits  = meta_tags[i];
        g_bank.pool[i].chapter_idx    = chapter_idxs[i];
        g_bank.pool[i].question_type  = types[i];
    }
    g_current_time = current_time;
    
    // Build chapter trie
    if (g_chapter_trie) trie_free(g_chapter_trie);
    g_chapter_trie = trie_new_node();
    for (uint32_t i = 0; i < count; i++) {
        char key[16]; 
        sprintf(key, "%u", g_bank.pool[i].chapter_idx);
        trie_insert(g_chapter_trie, key, i);
    }
    return (int)count;
}

EMSCRIPTEN_KEEPALIVE
void engine_generate_into_ptr(
    uint8_t  total_questions,
    uint8_t  total_marks,
    uint8_t  easy_pct,
    uint8_t  medium_pct,
    uint8_t  hard_pct,
    uint8_t* tag_types,     
    uint8_t* tag_percents,  
    uint8_t  tag_count,
    uint8_t* chapter_idxs,  
    uint8_t  chapter_count,
    int16_t  type_filter,
    uint32_t seed,
    SelectionResult* result
) {
    memset(result, 0, sizeof(SelectionResult));
    srand(seed);

    // STAGE 1 — Chapter and Type filter
    Question* filtered[MAX_QUESTIONS];
    uint32_t  filtered_count = 0;
    for (uint8_t c = 0; c < chapter_count; c++) {
        char key[16]; sprintf(key, "%u", chapter_idxs[c]);
        uint32_t found_count = 0;
        uint32_t* idxs = trie_lookup(g_chapter_trie, key, &found_count);
        if (!idxs) continue;
        for (uint32_t i = 0; i < found_count; i++) {
            Question* q = &g_bank.pool[idxs[i]];
            // Filter by type if requested
            if (type_filter != -1 && q->question_type != type_filter) continue;
            
            if (filtered_count < MAX_QUESTIONS) {
                filtered[filtered_count++] = q;
            }
        }
    }

    if (filtered_count == 0) {
        sprintf(result->report, "ERROR: No questions found for selected chapters.");
        return;
    }

    // STAGE 2 — Build blueprint
    PaperBlueprint bp;
    memset(&bp, 0, sizeof(bp));
    bp.total_questions  = total_questions;
    bp.total_marks      = total_marks;
    bp.easy_percent     = easy_pct;
    bp.medium_percent   = medium_pct;
    bp.hard_percent     = hard_pct;
    bp.slot_count       = tag_count;
    for (uint8_t i = 0; i < tag_count; i++) {
        bp.slots[i].tag     = tag_types[i];
        bp.slots[i].percent = tag_percents[i];
    }

    // STAGE 3 — Tag quota selection
    tag_quota_select(filtered, filtered_count, &bp, g_current_time, result);

    // STAGE 4 — Knapsack mark verification
    knapsack_verify_and_fix(result, g_bank.pool, g_bank.count, total_marks);

    // STAGE 5 — Fisher-Yates shuffle
    Question* final_ptrs[500];
    for (uint32_t i = 0; i < result->count; i++) {
        for (uint32_t j = 0; j < g_bank.count; j++) {
            if (g_bank.pool[j].id == result->question_ids[i]) {
                final_ptrs[i] = &g_bank.pool[j];
                break;
            }
        }
    }
    shuffle(final_ptrs, result->count, seed);
    for (uint32_t i = 0; i < result->count; i++) {
        result->question_ids[i] = final_ptrs[i]->id;
    }

    result->success = 1;
}
