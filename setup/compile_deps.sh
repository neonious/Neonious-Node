#!/bin/bash
#
# Compile dependencies (engines). Used for macOS, thus
# configured for OpenCL instead of CUDA.
#

DIR_NOW="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "${DIR_NOW}/.."
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

rm -rf engine
mkdir engine

cd deps
(cd autogrid;./configure;make)
cp autogrid/autogrid4 ../engine
cd AutoDock-GPU
git checkout 1.4.3
make DEVICE=OCLGPU NUMWI=128
cd ..
cp AutoDock-GPU/bin/autodock_gpu_128wi ../engine

cd gromacs
git checkout v2021.2
rm -rf build
mkdir -p build
cd build
cmake .. -DGMX_BUILD_OWN_FFTW=ON -DGMX_GPU=OpenCL -DCMAKE_INSTALL_PREFIX="${DIR}/engine/gromacs"
make
make install
cd "${DIR}"

cd deps/ethminer
git checkout v0.18.0
rm -rf build
mkdir -p build
cd build
# Bintray went out of service per May 1st, 2021
# Also Boost 1.66 does not work on macOS Catalina
# Changed to direct link to patched Boost 1.66 according to https://github.com/FISCO-BCOS/FISCO-BCOS/issues/1519
cp ../../../setup/ethminer.Hunter.config.cmake ../cmake/Hunter/config.cmake 
cp ../../../setup/ethminer.CLMiner.cpp ../libethash-cl/CLMiner.cpp
cmake .. -DETHASHCL=ON -DETHASHCUDA=OFF -DCMAKE_INSTALL_PREFIX="${DIR}/engine/ethminer"
make
make install
cd "${DIR}"