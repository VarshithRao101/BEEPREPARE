#ifndef BITMASK_H
#define BITMASK_H

#include "matrix_types.h"

typedef struct {
  uint64_t covered;   // subtopic bits already used
} BitState;

void    bit_init(BitState* s);
int     bit_collides(BitState* s, Question* q);
void    bit_mark(BitState* s, Question* q);
uint8_t bit_popcount(uint64_t v);  // count set bits

#endif
