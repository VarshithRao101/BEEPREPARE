#include "heap.h"

void compute_priority(Question* q, uint32_t now) {
    uint32_t days_since_use = (q->last_used_ts == 0) ? 999
                            : (now > q->last_used_ts ? (now - q->last_used_ts) / 86400 : 0);
    float recency_bonus = (days_since_use > 30) ? 15.0f 
                        : (days_since_use * 0.5f);
    q->priority_score = (q->importance    * 10.0f)
                      + (q->exam_frequency * 5.0f)
                      + recency_bonus
                      - (q->difficulty    * 2.0f);
}

void heap_init(MaxHeap* h) {
    h->size = 0;
}

static void swap(Question** a, Question** b) {
    Question* tmp = *a;
    *a = *b;
    *b = tmp;
}

void heap_push(MaxHeap* h, Question* q) {
    if (h->size >= MAX_QUESTIONS) return;
    h->data[h->size] = q;
    uint32_t i = h->size;
    h->size++;
    while (i > 0) {
        uint32_t p = (i - 1) / 2;
        if (h->data[i]->priority_score > h->data[p]->priority_score) {
            swap(&h->data[i], &h->data[p]);
            i = p;
        } else break;
    }
}

Question* heap_pop(MaxHeap* h) {
    if (h->size == 0) return NULL;
    Question* root = h->data[0];
    h->size--;
    h->data[0] = h->data[h->size];
    uint32_t i = 0;
    while (1) {
        uint32_t l = 2 * i + 1;
        uint32_t r = 2 * i + 2;
        uint32_t largest = i;
        if (l < h->size && h->data[l]->priority_score > h->data[largest]->priority_score) largest = l;
        if (r < h->size && h->data[r]->priority_score > h->data[largest]->priority_score) largest = r;
        if (largest != i) {
            swap(&h->data[i], &h->data[largest]);
            i = largest;
        } else break;
    }
    return root;
}
