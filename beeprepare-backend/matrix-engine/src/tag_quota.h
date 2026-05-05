#ifndef TAG_QUOTA_H
#define TAG_QUOTA_H

#include "matrix_types.h"
#include "heap.h"

void compute_quotas(PaperBlueprint* bp);
void redistribute_deficit(
  PaperBlueprint* bp,
  Question**      tag_pools[TAG_COUNT],
  uint32_t        tag_pool_sizes[TAG_COUNT]
);

void tag_quota_select(
  Question**       chapter_filtered,
  uint32_t         filtered_count,
  PaperBlueprint*  bp,
  uint32_t         current_timestamp,
  SelectionResult* result
);

#endif
