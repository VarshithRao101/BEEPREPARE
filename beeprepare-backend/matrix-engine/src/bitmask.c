#include "bitmask.h"

void bit_init(BitState* s) {
    s->covered = 0;
}

int bit_collides(BitState* s, Question* q) {
    return (s->covered & q->subtopic_bits) != 0;
}

void bit_mark(BitState* s, Question* q) {
    s->covered |= q->subtopic_bits;
}

uint8_t bit_popcount(uint64_t v) {
    uint8_t count = 0;
    while (v) {
        v &= (v - 1);
        count++;
    }
    return count;
}
