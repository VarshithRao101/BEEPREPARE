#ifndef MATRIX_TYPES_H
#define MATRIX_TYPES_H

#include <stdint.h>
#include <stddef.h>

#define MAX_QUESTIONS  10000
#define MAX_CHAPTERS   128

// Meta tag enum — each question can have multiple
typedef enum {
  TAG_IMPORTANT  = 0,
  TAG_REPEATED   = 1,
  TAG_FORMULA    = 2,
  TAG_CONCEPTUAL = 3,
  TAG_PYQS       = 4,
  TAG_TRICKY     = 5,
  TAG_STANDARD   = 6,
  TAG_COUNT      = 7
} MetaTag;

typedef enum {
  TYPE_MCQ           = 0,
  TYPE_VERY_SHORT    = 1,
  TYPE_SHORT         = 2,
  TYPE_LONG          = 3,
  TYPE_ESSAY         = 4,
  TYPE_TRUE_FALSE    = 5,
  TYPE_FILL_BLANKS   = 6,
  TYPE_SIMPLE_MATCH  = 7,
  TYPE_MATRIX_MATCH  = 8,
  TYPE_PASSAGE       = 9,
  TYPE_CASE_STUDY    = 10,
  TYPE_DATA_INTERP   = 11,
  TYPE_COUNT         = 12
} QuestionType;

// Bitmask encoding of meta tags
#define TAG_BIT(t) (1u << (t))
#define HAS_TAG(bitmask, t) ((bitmask) & TAG_BIT(t))

typedef struct {
  uint32_t   id;
  uint8_t    marks;           // 1, 2, 4
  uint8_t    difficulty;      // 1=easy 2=medium 3=hard
  uint8_t    importance;      // 1-10 score
  uint8_t    exam_frequency;  // 1-10
  uint32_t   last_used_ts;    // unix timestamp
  uint64_t   subtopic_bits;   // which subtopics (for collision check)
  uint8_t    meta_tag_bits;   // bitmask of MetaTag enum values
  uint8_t    chapter_idx;     // index into chapter lookup table
  uint8_t    question_type;   // QuestionType enum value
  float      priority_score;  // computed by heap stage
} Question;

typedef struct {
  Question  pool[MAX_QUESTIONS];
  uint32_t  count;
  char      chapter_ids[MAX_CHAPTERS][64];
  uint8_t   chapter_count;
} QuestionBank;

// Tag distribution — the percentage blueprint
typedef struct {
  uint8_t  tag;         // MetaTag enum value
  uint8_t  percent;     // 0-100
  uint32_t quota;       // computed: floor(total_questions * percent/100)
} TagSlot;

typedef struct {
  TagSlot  slots[TAG_COUNT];
  uint8_t  slot_count;
  uint32_t total_questions;  // total Q count for the paper
  uint8_t  total_marks;
  uint8_t  easy_percent;     // % of paper that should be easy
  uint8_t  medium_percent;
  uint8_t  hard_percent;
  uint8_t  chapter_filter[MAX_CHAPTERS]; // which chapter indices to include
  uint8_t  chapter_filter_count;
  int16_t  type_filter;      // -1 = all, otherwise TYPE_ enum
} PaperBlueprint;

typedef struct {
  uint32_t  question_ids[500];
  uint32_t  count;
  uint8_t   total_marks;
  uint8_t   success;          // 1 = fully satisfied blueprint
  uint8_t   tag_satisfaction[TAG_COUNT]; // % satisfied per tag
  char      report[512];      // human-readable generation report
} SelectionResult;

#endif
