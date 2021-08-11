## Preperation steps:

	git submodule update --init --recursive
	npm i
	cd app; npm i; cd ..
	cd frontend; npm i; cd ..
	
	(only on macOS and Linux)
	cd app; ../node_modules/.bin/electron-rebuild; cd ..
	cd setup
	. compile_deps.opencl.sh
	cd ..

	(only on Windows)
	copy https://www.neonious.org/static/neonious-node-engine-cuda-1.0.0-win.zip
	or copy https://www.neonious.org/static/neonious-node-engine-opencl-1.0.0-win.zip
	to engine

## Run development version:

npm start


## Build distributable version:

npm run dist

Please note that this version is NOT code signed by Neonious GmbH.
Thus, please use the officially packed releases.


# WINDOWS COMPILATION INSTRUCTIONS OF ENGINES

This part is very much manual work. Not automized well.

Instead, consider using the packages
https://www.neonious.org/static/neonious-node-engine-cuda-1.0.0-win.zip
https://www.neonious.org/static/neonious-node-engine-opencl-1.0.0-win.zip

Goal: Create executables which run on any system with Cuda 11.2
or OpenCL installed


## Compile autogrid4

Install MSYS2 and install MinGW-64 with it
In MinGW-64 terminal:

check if gcc -v really is MinGW

	./configure

then add static and static-libstdc++in Makefile

	CXXCOMPILE = $(CXX) $(DEFS) $(DEFAULT_INCLUDES) $(INCLUDES) \
		$(AM_CPPFLAGS) $(CPPFLAGS) $(AM_CXXFLAGS) $(CXXFLAGS) -static -static-libstdc++
	CXXLD = $(CXX) -static -static-libstdc++
	CXXLINK = $(CXXLD) $(AM_CXXFLAGS) $(CXXFLAGS) $(AM_LDFLAGS) $(LDFLAGS) \
		-o $@
	COMPILE = $(CC) $(DEFS) $(DEFAULT_INCLUDES) $(INCLUDES) $(AM_CPPFLAGS) \
		$(CPPFLAGS) $(AM_CFLAGS) $(CFLAGS) -static -static-libstdc++
	CCLD = $(CC) -static -static-libstdc++
	LINK = $(CCLD) $(AM_CFLAGS) $(CFLAGS) $(AM_LDFLAGS) $(LDFLAGS) -o $@

	make

Copy executable into engine directory


## Compile AutoDock-GPU

Use Visual Studio 2019 Project in setup/AutoDock-GPU or setup/AutoDock-GPU-OpenCL

You need to rename deps/AutoDock-GPU/host/inc/performdocking.h.Cuda
or deps/AutoDock-GPU/host/inc/performdocking.h.OpenCL to
deps/AutoDock-GPU/host/inc/performdocking.h

Copy executable into engine directory


## Compile Gromacs

There are several steps needed for Gromacs to compile under Visual Studio 2019

Use CMake GUI to generate Makefiles
install directory set to <PROJECT_DIR>/engine/gromacs

	GMX_GPU = CUDA
	GMX_FFT_LIBRARY = mkl
	GMXAPI=off
	MKL_INCLUDE_DIR = C:/Program Files (x86)/Intel/oneAPI/mkl/2021.1.1/include;C:/Program Files (x86)/Intel/oneAPI/mkl/2021.1.1/include/intel64
	MKL_LIBRARIES = C:/Program Files (x86)/Intel/oneAPI/mkl/2021.1.1/lib/intel64/mkl_rt.lib
	BUILD_TESTING off
	CUDA_SDK_ROOT_DIR = C:/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v11.2

Delete from gmxManageNvccConfig.cmake:

	if (CUDA_VERSION VERSION_LESS 11.0)
	    # CUDA doesn't formally support C++17 until version 11.0, so for
	    # now host-side code that compiles with CUDA is restricted to
	    # C++14. This needs to be expressed formally for older CUDA
	    # version.
	    list(APPEND GMX_CUDA_NVCC_FLAGS "${CMAKE_CXX14_STANDARD_COMPILE_OPTION}")
	else()
	    # gcc-7 pre-dated C++17, so uses the -std=c++1z compiler flag for it,
	    # which modern nvcc does not recognize. So we work around that by
	    # compiling in C++14 mode. Clang doesn't have this problem because nvcc
	    # only supports version of clang that already understood -std=c++17
	    if (CMAKE_CXX_COMPILER_ID MATCHES "GNU" AND CMAKE_CXX_COMPILER_VERSION VERSION_LESS 8)
	        list(APPEND GMX_CUDA_NVCC_FLAGS "${CMAKE_CXX14_STANDARD_COMPILE_OPTION}")
	    else()
	        list(APPEND GMX_CUDA_NVCC_FLAGS "${CMAKE_CXX17_STANDARD_COMPILE_OPTION}")
	    endif()
	endif()

Open Gromacs.sln
Switch to x64 Release
Set all runtime libs in C/C++ properties of Projects to Multithreaded
Build

cmake --install .

copy mkl redist + intel compiler redist + vcruntime140.dll + vcomp140.dll into engine/gromacs/bin
These libraries may all be redistributed.


## Compile ethminer

Copy setup/ethminer.Hunter.config.cmake as shown in setup/compile_deps.cuda.sh

Native Perl must be installed, msys2 perl does not work.
Otherwise CMake will bail out at OpenSSL

OpenCL.lib must be taken from non-Hunter, because the Hunter version does not work

On Windows we also do the following, to potentially get around not so intelligent AntiVirus software:
Renamed executable from ethminer to neonmine
Renamed mentions of ethminer to neonmine in ethminer-buildinfo project
Removed ethminer.rc (icon)

Also we removed support for Intel in CLMiner.cpp