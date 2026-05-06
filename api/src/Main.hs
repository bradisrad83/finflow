{-# LANGUAGE DataKinds         #-}
{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE TypeOperators     #-}

module Main where

import Control.Monad.IO.Class      (liftIO)
import Data.Text                   (Text)
import Database.SQLite.Simple      (Connection, open)
import Network.Wai.Handler.Warp    (run)
import Network.Wai.Middleware.Cors (cors, corsMethods, corsRequestHeaders, simpleCorsResourcePolicy)
import Servant
import qualified DB
import Types

-- ---------------------------------------------------------------------------
-- API type
-- ---------------------------------------------------------------------------

type API =
       "accounts" :> Get '[JSON] [Account]
  :<|> "accounts" :> Capture "id" Text :> "transactions" :> Get '[JSON] [Transaction]
  :<|> "accounts" :> ReqBody '[JSON] Account :> Post '[JSON] Account
  :<|> "accounts" :> Capture "id" Text :> "transactions" :> ReqBody '[JSON] Transaction :> Post '[JSON] Transaction
  :<|> "transactions" :> Capture "id" Text :> DeleteNoContent

-- ---------------------------------------------------------------------------
-- Handlers
-- ---------------------------------------------------------------------------

getAccounts :: Connection -> Handler [Account]
getAccounts conn = liftIO $ DB.getAccounts conn

getTransactions :: Connection -> Text -> Handler [Transaction]
getTransactions conn aid = liftIO $ DB.getTransactionsByAccount conn aid

postAccount :: Connection -> Account -> Handler Account
postAccount conn acc = liftIO $ DB.insertAccount conn acc

postTransaction :: Connection -> Text -> Transaction -> Handler Transaction
postTransaction conn _ txn = liftIO $ DB.insertTransaction conn txn

deleteTransaction :: Connection -> Text -> Handler NoContent
deleteTransaction conn tid = do
  liftIO $ DB.removeTransaction conn tid
  return NoContent

-- ---------------------------------------------------------------------------
-- Server
-- ---------------------------------------------------------------------------

makeServer :: Connection -> Server API
makeServer conn =
       getAccounts    conn
  :<|> getTransactions conn
  :<|> postAccount    conn
  :<|> postTransaction conn
  :<|> deleteTransaction conn

api :: Proxy API
api = Proxy

-- ---------------------------------------------------------------------------
-- Entry point
-- ---------------------------------------------------------------------------

main :: IO ()
main = do
  conn <- open "finflow.db"
  DB.initDB conn
  putStrLn "FinFlow API running on http://localhost:8080"
  let policy = simpleCorsResourcePolicy
        { corsMethods        = ["GET", "POST", "DELETE", "OPTIONS"]
        , corsRequestHeaders = ["Content-Type"]
        }
  run 8080 $ cors (const $ Just policy) $ serve api (makeServer conn)
