#ifndef FISHER_YATES_H
#define FISHER_YATES_H

#include "matrix_types.h"

void fisher_yates_shuffle(Question** arr, uint32_t n, uint32_t seed);

#endif
