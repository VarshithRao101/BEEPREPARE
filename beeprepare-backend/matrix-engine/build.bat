@echo off
echo [Matrix Engine] Starting Windows Build Sequence...

cd emsdk
call emsdk.bat activate latest
call emsdk_env.bat
cd ..

if not exist build mkdir build

echo [Matrix Engine] Compiling C Source to WebAssembly...

emcc ^
  src/trie.c ^
  src/heap.c ^
  src/knapsack.c ^
  src/bitmask.c ^
  src/shuffle.c ^
  src/tag_quota.c ^
  src/matrix_engine.c ^
  -o build/matrix_engine.js ^
  -s WASM=1 ^
  -s EXPORTED_FUNCTIONS="['_engine_load','_engine_generate_into_ptr','_malloc','_free']" ^
  -s EXPORTED_RUNTIME_METHODS="['ccall','cwrap','HEAPU8','HEAPU32']" ^
  -s ALLOW_MEMORY_GROWTH=1 ^
  -s INITIAL_MEMORY=33554432 ^
  -O3 ^
  --no-entry

echo [Matrix Engine] Build complete: build/matrix_engine.wasm
pause
