#ifndef TRIE_H
#define TRIE_H

#include "matrix_types.h"

typedef struct TrieNode {
  struct TrieNode* children[96];  // printable ASCII
  uint32_t         q_indices[MAX_QUESTIONS];
  uint32_t         q_count;
  uint8_t          is_terminal;
} TrieNode;

TrieNode* trie_new_node();
void      trie_insert(TrieNode* root, const char* key, uint32_t q_idx);
uint32_t* trie_lookup(TrieNode* root, const char* key, uint32_t* out_count);
void      trie_free(TrieNode* root);

#endif
