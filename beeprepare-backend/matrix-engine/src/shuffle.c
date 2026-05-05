#include "shuffle.h"

uint32_t lcg_next(uint32_t* state) {
    *state = *state * 1664525u + 1013904223u;
    return *state;
}

void shuffle(Question** arr, uint32_t n, uint32_t seed) {
    if (n <= 1) return;
    uint32_t state = seed;
    for (uint32_t i = n - 1; i > 0; i--) {
        uint32_t j = lcg_next(&state) % (i + 1);
        Question* tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
}
