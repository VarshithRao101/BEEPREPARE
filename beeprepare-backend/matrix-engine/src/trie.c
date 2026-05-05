#include "trie.h"
#include <stdlib.h>
#include <string.h>

TrieNode* trie_new_node() {
    TrieNode* node = (TrieNode*)malloc(sizeof(TrieNode));
    if (node) {
        node->q_count = 0;
        node->is_terminal = 0;
        for (int i = 0; i < 96; i++) node->children[i] = NULL;
    }
    return node;
}

void trie_insert(TrieNode* root, const char* key, uint32_t q_idx) {
    TrieNode* curr = root;
    for (int i = 0; key[i] != '\0'; i++) {
        int idx = (int)key[i] - 32;
        if (idx < 0 || idx >= 96) continue;
        if (!curr->children[idx]) {
            curr->children[idx] = trie_new_node();
        }
        curr = curr->children[idx];
    }
    curr->is_terminal = 1;
    if (curr->q_count < MAX_QUESTIONS) {
        curr->q_indices[curr->q_count++] = q_idx;
    }
}

uint32_t* trie_lookup(TrieNode* root, const char* key, uint32_t* out_count) {
    TrieNode* curr = root;
    for (int i = 0; key[i] != '\0'; i++) {
        int idx = (int)key[i] - 32;
        if (idx < 0 || idx >= 96) return NULL;
        if (!curr->children[idx]) return NULL;
        curr = curr->children[idx];
    }
    if (curr->is_terminal) {
        *out_count = curr->q_count;
        return curr->q_indices;
    }
    return NULL;
}

void trie_free(TrieNode* root) {
    if (!root) return;
    for (int i = 0; i < 96; i++) {
        if (root->children[i]) trie_free(root->children[i]);
    }
    free(root);
}
