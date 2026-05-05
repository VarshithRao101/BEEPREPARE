#ifndef HEAP_H
#define HEAP_H

#include "matrix_types.h"

typedef struct {
  Question* data[MAX_QUESTIONS];
  uint32_t  size;
} MaxHeap;

void      heap_init(MaxHeap* h);
void      heap_push(MaxHeap* h, Question* q);
Question* heap_pop(MaxHeap* h);   // extract max
void      compute_priority(Question* q, uint32_t now);

#endif
