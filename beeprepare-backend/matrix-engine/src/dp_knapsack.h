#ifndef DP_KNAPSACK_H
#define DP_KNAPSACK_H

#include "matrix_types.h"

// candidates: array of Question pointers (heap-ranked order)
// n_candidates: how many
// blueprint: the paper requirements
// out_result: populated with selected question IDs
void dp_select_questions(
  Question**      candidates,
  uint32_t        n_candidates,
  PaperBlueprint* blueprint,
  SelectionResult* out_result
);

#endif
