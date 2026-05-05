#ifndef SHUFFLE_H
#define SHUFFLE_H

#include "matrix_types.h"

uint32_t lcg_next(uint32_t* state);
void shuffle(Question** arr, uint32_t n, uint32_t seed);

#endif
