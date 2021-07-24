hunter_config(CURL VERSION ${HUNTER_CURL_VERSION} CMAKE_ARGS HTTP_ONLY=ON CMAKE_USE_OPENSSL=OFF CMAKE_USE_LIBSSH2=OFF CURL_CA_PATH=none)
hunter_config(
    Boost
    VERSION 1.66.0_fixed
    SHA1 ce782d13f144bfe60d26b211574d88937988a3b6
    URL https://www.neonious.org/static/fixed/boost_1_66_0.tar.gz
)
