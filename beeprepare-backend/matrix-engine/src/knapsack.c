#include "knapsack.h"
#include <string.h>

uint8_t knapsack_verify_and_fix(
  SelectionResult* result,
  Question*        bank,
  uint32_t         bank_count,
  uint8_t          target_marks
) {
    uint32_t current_marks = 0;
    for (uint32_t i = 0; i < result->count; i++) {
        for (uint32_t j = 0; j < bank_count; j++) {
            if (bank[j].id == result->question_ids[i]) {
                current_marks += bank[j].marks;
                break;
            }
        }
    }

    if (current_marks == target_marks) return 1;

    // Greedy Swapping
    int diff = (int)target_marks - (int)current_marks;
    for (uint32_t i = 0; i < result->count && diff != 0; i++) {
        Question* q_in = NULL;
        for (uint32_t k = 0; k < bank_count; k++) {
            if (bank[k].id == result->question_ids[i]) { q_in = &bank[k]; break; }
        }
        if (!q_in) continue;

        for (uint32_t j = 0; j < bank_count && diff != 0; j++) {
            int already_selected = 0;
            for (uint32_t m = 0; m < result->count; m++) {
                if (result->question_ids[m] == bank[j].id) { already_selected = 1; break; }
            }
            if (already_selected) continue;

            int swap_gain = (int)bank[j].marks - (int)q_in->marks;
            if (diff > 0 && swap_gain > 0 && swap_gain <= diff) {
                result->question_ids[i] = bank[j].id;
                diff -= swap_gain;
                current_marks += swap_gain;
            } else if (diff < 0 && swap_gain < 0 && swap_gain >= diff) {
                result->question_ids[i] = bank[j].id;
                diff -= swap_gain;
                current_marks += swap_gain;
            }
        }
    }

    result->total_marks = (uint8_t)current_marks;
    return (current_marks == target_marks);
}
