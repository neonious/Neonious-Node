#!/bin/bash
DIR_NOW="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "${DIR_NOW}/.."
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

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
cmake .. -DGMX_BUILD_OWN_FFTW=ON -DCMAKE_INSTALL_PREFIX="${DIR}/engine/gromacs"
make
make install
cd "${DIR}"
