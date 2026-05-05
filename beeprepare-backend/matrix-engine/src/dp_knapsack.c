#include "dp_knapsack.h"
#include <string.h>

void dp_select_questions(
  Question**      candidates,
  uint32_t        n_candidates,
  PaperBlueprint* blueprint,
  SelectionResult* out_result
) {
    // Initialize result
    out_result->count = 0;
    out_result->total_marks_achieved = 0;
    out_result->success = 0;

    // STEP 1 — Separate candidates into 3 difficulty buckets
    Question* easy_pool[MAX_QUESTIONS];   uint32_t easy_count = 0;
    Question* medium_pool[MAX_QUESTIONS]; uint32_t medium_count = 0;
    Question* hard_pool[MAX_QUESTIONS];   uint32_t hard_count = 0;

    for (uint32_t i = 0; i < n_candidates; i++) {
        if (candidates[i]->difficulty == EASY) easy_pool[easy_count++] = candidates[i];
        else if (candidates[i]->difficulty == MEDIUM) medium_pool[medium_count++] = candidates[i];
        else if (candidates[i]->difficulty == HARD) hard_pool[hard_count++] = candidates[i];
    }

    uint8_t satisfied_buckets = 0;

    // Helper to process a bucket
    auto process_bucket = [&](Question** pool, uint32_t pool_size, uint8_t target_count, uint8_t marks_per) {
        if (target_count == 0) {
            satisfied_buckets++;
            return;
        }
        
        uint8_t target_marks = target_count * marks_per;
        // dp[i][w] = 1 if we can select exactly i questions using exactly w total marks
        // Using static to avoid stack overflow in WASM if memory is tight
        static uint8_t dp[201][201]; 
        static int parent[201][201]; // To store which question index was used

        memset(dp, 0, sizeof(dp));
        memset(parent, -1, sizeof(parent));
        dp[0][0] = 1;

        for (uint32_t q_idx = 0; q_idx < pool_size; q_idx++) {
            uint8_t q_marks = pool[q_idx]->marks;
            for (int i = target_count; i >= 1; i--) {
                for (int w = target_marks; w >= q_marks; w--) {
                    if (!dp[i][w] && dp[i-1][w - q_marks]) {
                        dp[i][w] = 1;
                        parent[i][w] = q_idx;
                    }
                }
            }
        }

        if (dp[target_count][target_marks]) {
            satisfied_buckets++;
            // Backtrack
            int curr_i = target_count;
            int curr_w = target_marks;
            while (curr_i > 0 && curr_w > 0) {
                int q_idx = parent[curr_i][curr_w];
                if (q_idx == -1) break;
                out_result->question_ids[out_result->count++] = pool[q_idx]->id;
                out_result->total_marks_achieved += pool[q_idx]->marks;
                curr_w -= pool[q_idx]->marks;
                curr_i--;
            }
        }
    };

    // Note: C doesn't support lambdas like this (auto), but I'll write it as a local logic block or separate function.
    // Let's rewrite as a proper function or inline it. I'll inline it for simplicity in this specific context.

    // --- Easy Bucket ---
    {
        uint8_t target_count = blueprint->easy_count;
        uint8_t marks_per = blueprint->marks_per_easy;
        if (target_count == 0) { satisfied_buckets++; }
        else {
            uint8_t target_marks = target_count * marks_per;
            static uint8_t dp[201][201]; 
            static int parent[201][201];
            memset(dp, 0, sizeof(dp));
            memset(parent, -1, sizeof(parent));
            dp[0][0] = 1;
            for (uint32_t q_idx = 0; q_idx < easy_count; q_idx++) {
                uint8_t q_marks = easy_pool[q_idx]->marks;
                for (int i = target_count; i >= 1; i--) {
                    for (int w = target_marks; w >= q_marks; w--) {
                        if (!dp[i][w] && dp[i-1][w - q_marks]) {
                            dp[i][w] = 1;
                            parent[i][w] = q_idx;
                        }
                    }
                }
            }
            if (dp[target_count][target_marks]) {
                satisfied_buckets++;
                int curr_i = target_count; int curr_w = target_marks;
                while (curr_i > 0 && curr_w > 0) {
                    int q_idx = parent[curr_i][curr_w];
                    if (q_idx == -1) break;
                    out_result->question_ids[out_result->count++] = easy_pool[q_idx]->id;
                    out_result->total_marks_achieved += easy_pool[q_idx]->marks;
                    curr_w -= easy_pool[q_idx]->marks; curr_i--;
                }
            }
        }
    }

    // --- Medium Bucket ---
    {
        uint8_t target_count = blueprint->medium_count;
        uint8_t marks_per = blueprint->marks_per_medium;
        if (target_count == 0) { satisfied_buckets++; }
        else {
            uint8_t target_marks = target_count * marks_per;
            static uint8_t dp[201][201]; 
            static int parent[201][201];
            memset(dp, 0, sizeof(dp));
            memset(parent, -1, sizeof(parent));
            dp[0][0] = 1;
            for (uint32_t q_idx = 0; q_idx < medium_count; q_idx++) {
                uint8_t q_marks = medium_pool[q_idx]->marks;
                for (int i = target_count; i >= 1; i--) {
                    for (int w = target_marks; w >= q_marks; w--) {
                        if (!dp[i][w] && dp[i-1][w - q_marks]) {
                            dp[i][w] = 1;
                            parent[i][w] = q_idx;
                        }
                    }
                }
            }
            if (dp[target_count][target_marks]) {
                satisfied_buckets++;
                int curr_i = target_count; int curr_w = target_marks;
                while (curr_i > 0 && curr_w > 0) {
                    int q_idx = parent[curr_i][curr_w];
                    if (q_idx == -1) break;
                    out_result->question_ids[out_result->count++] = medium_pool[q_idx]->id;
                    out_result->total_marks_achieved += medium_pool[q_idx]->marks;
                    curr_w -= medium_pool[q_idx]->marks; curr_i--;
                }
            }
        }
    }

    // --- Hard Bucket ---
    {
        uint8_t target_count = blueprint->hard_count;
        uint8_t marks_per = blueprint->marks_per_hard;
        if (target_count == 0) { satisfied_buckets++; }
        else {
            uint8_t target_marks = target_count * marks_per;
            static uint8_t dp[201][201]; 
            static int parent[201][201];
            memset(dp, 0, sizeof(dp));
            memset(parent, -1, sizeof(parent));
            dp[0][0] = 1;
            for (uint32_t q_idx = 0; q_idx < hard_count; q_idx++) {
                uint8_t q_marks = hard_pool[q_idx]->marks;
                for (int i = target_count; i >= 1; i--) {
                    for (int w = target_marks; w >= q_marks; w--) {
                        if (!dp[i][w] && dp[i-1][w - q_marks]) {
                            dp[i][w] = 1;
                            parent[i][w] = q_idx;
                        }
                    }
                }
            }
            if (dp[target_count][target_marks]) {
                satisfied_buckets++;
                int curr_i = target_count; int curr_w = target_marks;
                while (curr_i > 0 && curr_w > 0) {
                    int q_idx = parent[curr_i][curr_w];
                    if (q_idx == -1) break;
                    out_result->question_ids[out_result->count++] = hard_pool[q_idx]->id;
                    out_result->total_marks_achieved += hard_pool[q_idx]->marks;
                    curr_w -= hard_pool[q_idx]->marks; curr_i--;
                }
            }
        }
    }

    if (satisfied_buckets == 3) {
        out_result->success = 1;
    }
}
