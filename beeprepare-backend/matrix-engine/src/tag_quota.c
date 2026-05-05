#include "tag_quota.h"
#include "bitmask.h"
#include <string.h>
#include <stdio.h>

void compute_quotas(PaperBlueprint* bp) {
    uint32_t assigned = 0;
    uint8_t max_idx = 0;
    for (uint8_t i = 0; i < bp->slot_count; i++) {
        bp->slots[i].quota = (bp->total_questions * bp->slots[i].percent) / 100;
        assigned += bp->slots[i].quota;
        if (bp->slots[i].percent > bp->slots[max_idx].percent) max_idx = i;
    }
    uint32_t leftover = bp->total_questions - assigned;
    if (leftover > 0 && bp->slot_count > 0) bp->slots[max_idx].quota += leftover;
}

void tag_quota_select(
  Question**       chapter_filtered,
  uint32_t         filtered_count,
  PaperBlueprint*  bp,
  uint32_t         current_timestamp,
  SelectionResult* result
) {
    Question* tag_pools[TAG_COUNT][MAX_QUESTIONS];
    uint32_t  tag_pool_sizes[TAG_COUNT];
    memset(tag_pool_sizes, 0, sizeof(tag_pool_sizes));

    for (uint32_t i = 0; i < filtered_count; i++) {
        for (int t = 0; t < TAG_COUNT; t++) {
            if (HAS_TAG(chapter_filtered[i]->meta_tag_bits, t)) {
                tag_pools[t][tag_pool_sizes[t]++] = chapter_filtered[i];
            }
        }
    }

    compute_quotas(bp);

    // Sort slots by percent DESC
    for (uint8_t i = 0; i < bp->slot_count; i++) {
        for (uint8_t j = i + 1; j < bp->slot_count; j++) {
            if (bp->slots[j].percent > bp->slots[i].percent) {
                TagSlot tmp = bp->slots[i];
                bp->slots[i] = bp->slots[j];
                bp->slots[j] = tmp;
            }
        }
    }

    BitState bstate;
    bit_init(&bstate);

    for (uint8_t i = 0; i < bp->slot_count; i++) {
        uint8_t tag = bp->slots[i].tag;
        uint32_t needed = bp->slots[i].quota;
        
        MaxHeap slot_heap;
        heap_init(&slot_heap);
        for (uint32_t j = 0; j < tag_pool_sizes[tag]; j++) {
            compute_priority(tag_pools[tag][j], current_timestamp);
            heap_push(&slot_heap, tag_pools[tag][j]);
        }

        uint32_t selected = 0;
        uint32_t collision_retries = 0;
        Question* overflow_buffer[MAX_QUESTIONS];
        uint32_t overflow_count = 0;

        while (slot_heap.size > 0 && selected < needed) {
            Question* q = heap_pop(&slot_heap);
            
            // Check if already in result
            int exists = 0;
            for (uint32_t k = 0; k < result->count; k++) {
                if (result->question_ids[k] == q->id) { exists = 1; break; }
            }
            if (exists) continue;

            if (bit_collides(&bstate, q)) {
                overflow_buffer[overflow_count++] = q;
                if (collision_retries++ > needed * 3) break;
            } else {
                bit_mark(&bstate, q);
                result->question_ids[result->count++] = q->id;
                selected++;
            }
        }

        // Fill from overflow if still needed
        uint32_t oi = 0;
        while (selected < needed && oi < overflow_count) {
            result->question_ids[result->count++] = overflow_buffer[oi++]->id;
            selected++;
        }
        
        result->tag_satisfaction[tag] = (needed > 0) ? (selected * 100) / needed : 100;
        bp->slots[i].quota = selected; // record actual filled count
    }

    // Deficit redistribution
    uint32_t current_total = result->count;
    if (current_total < bp->total_questions) {
        uint32_t deficit = bp->total_questions - current_total;
        for (int t = 0; t < TAG_COUNT && deficit > 0; t++) {
            for (uint32_t j = 0; j < tag_pool_sizes[t] && deficit > 0; j++) {
                int exists = 0;
                for (uint32_t k = 0; k < result->count; k++) {
                    if (result->question_ids[k] == tag_pools[t][j]->id) { exists = 1; break; }
                }
                if (!exists) {
                    result->question_ids[result->count++] = tag_pools[t][j]->id;
                    deficit--;
                }
            }
        }
    }

    sprintf(result->report, "Generated %u questions. Tags Sat: %d%%", result->count, result->tag_satisfaction[bp->slots[0].tag]);
    result->success = (result->count >= bp->total_questions);
}
