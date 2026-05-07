{-# LANGUAGE CPP #-}
{-# LANGUAGE NoRebindableSyntax #-}
#if __GLASGOW_HASKELL__ >= 810
{-# OPTIONS_GHC -Wno-prepositive-qualified-module #-}
#endif
{-# OPTIONS_GHC -fno-warn-missing-import-lists #-}
{-# OPTIONS_GHC -w #-}
module Paths_finflow_api (
    version,
    getBinDir, getLibDir, getDynLibDir, getDataDir, getLibexecDir,
    getDataFileName, getSysconfDir
  ) where


import qualified Control.Exception as Exception
import qualified Data.List as List
import Data.Version (Version(..))
import System.Environment (getEnv)
import Prelude


#if defined(VERSION_base)

#if MIN_VERSION_base(4,0,0)
catchIO :: IO a -> (Exception.IOException -> IO a) -> IO a
#else
catchIO :: IO a -> (Exception.Exception -> IO a) -> IO a
#endif

#else
catchIO :: IO a -> (Exception.IOException -> IO a) -> IO a
#endif
catchIO = Exception.catch

version :: Version
version = Version [0,1,0,0] []

getDataFileName :: FilePath -> IO FilePath
getDataFileName name = do
  dir <- getDataDir
  return (dir `joinFileName` name)

getBinDir, getLibDir, getDynLibDir, getDataDir, getLibexecDir, getSysconfDir :: IO FilePath




bindir, libdir, dynlibdir, datadir, libexecdir, sysconfdir :: FilePath
bindir     = "/Users/bradgoldsmith/Desktop/macbook-air/repos/finflow/api/.stack-work/install/aarch64-osx/4cdbcba350f025af5f0f8c883af1639d176678d2b218ef98eabf74bf06eef94c/9.10.3/bin"
libdir     = "/Users/bradgoldsmith/Desktop/macbook-air/repos/finflow/api/.stack-work/install/aarch64-osx/4cdbcba350f025af5f0f8c883af1639d176678d2b218ef98eabf74bf06eef94c/9.10.3/lib/aarch64-osx-ghc-9.10.3-fe9c/finflow-api-0.1.0.0-HlOQBEOVRQz7Rp6qtYYSto-finflow-api"
dynlibdir  = "/Users/bradgoldsmith/Desktop/macbook-air/repos/finflow/api/.stack-work/install/aarch64-osx/4cdbcba350f025af5f0f8c883af1639d176678d2b218ef98eabf74bf06eef94c/9.10.3/lib/aarch64-osx-ghc-9.10.3-fe9c"
datadir    = "/Users/bradgoldsmith/Desktop/macbook-air/repos/finflow/api/.stack-work/install/aarch64-osx/4cdbcba350f025af5f0f8c883af1639d176678d2b218ef98eabf74bf06eef94c/9.10.3/share/aarch64-osx-ghc-9.10.3-fe9c/finflow-api-0.1.0.0"
libexecdir = "/Users/bradgoldsmith/Desktop/macbook-air/repos/finflow/api/.stack-work/install/aarch64-osx/4cdbcba350f025af5f0f8c883af1639d176678d2b218ef98eabf74bf06eef94c/9.10.3/libexec/aarch64-osx-ghc-9.10.3-fe9c/finflow-api-0.1.0.0"
sysconfdir = "/Users/bradgoldsmith/Desktop/macbook-air/repos/finflow/api/.stack-work/install/aarch64-osx/4cdbcba350f025af5f0f8c883af1639d176678d2b218ef98eabf74bf06eef94c/9.10.3/etc"

getBinDir     = catchIO (getEnv "finflow_api_bindir")     (\_ -> return bindir)
getLibDir     = catchIO (getEnv "finflow_api_libdir")     (\_ -> return libdir)
getDynLibDir  = catchIO (getEnv "finflow_api_dynlibdir")  (\_ -> return dynlibdir)
getDataDir    = catchIO (getEnv "finflow_api_datadir")    (\_ -> return datadir)
getLibexecDir = catchIO (getEnv "finflow_api_libexecdir") (\_ -> return libexecdir)
getSysconfDir = catchIO (getEnv "finflow_api_sysconfdir") (\_ -> return sysconfdir)



joinFileName :: String -> String -> FilePath
joinFileName ""  fname = fname
joinFileName "." fname = fname
joinFileName dir ""    = dir
joinFileName dir fname
  | isPathSeparator (List.last dir) = dir ++ fname
  | otherwise                       = dir ++ pathSeparator : fname

pathSeparator :: Char
pathSeparator = '/'

isPathSeparator :: Char -> Bool
isPathSeparator c = c == '/'
