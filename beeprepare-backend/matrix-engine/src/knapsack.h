#ifndef KNAPSACK_H
#define KNAPSACK_H

#include "matrix_types.h"

// Returns 1 if exact marks achieved, 0 if best-effort
uint8_t knapsack_verify_and_fix(
  SelectionResult* result,
  Question*        bank,     // full bank for swapping
  uint32_t         bank_count,
  uint8_t          target_marks
);

#endif
