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
  :<|> "accounts" :> Capture "id" Text :> DeleteNoContent
  :<|> "accounts" :> Capture "id" Text :> ReqBody '[JSON] Account :> Patch '[JSON] Account
  :<|> "transactions" :> Capture "id" Text :> ReqBody '[JSON] Transaction :> Patch '[JSON] Transaction

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

deleteAccount :: Connection -> Text -> Handler NoContent
deleteAccount conn aid = do
  liftIO $ DB.removeAccount conn aid
  return NoContent

patchAccount :: Connection -> Text -> Account -> Handler Account
patchAccount conn _ acc = liftIO $ DB.updateAccount conn acc

patchTransaction :: Connection -> Text -> Transaction -> Handler Transaction
patchTransaction conn _ txn = liftIO $ DB.updateTransaction conn txn

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
  :<|> deleteAccount conn
  :<|> patchAccount conn
  :<|> patchTransaction conn

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
        { corsMethods        = ["GET", "POST", "DELETE", "PATCH", "OPTIONS"]
        , corsRequestHeaders = ["Content-Type"]
        }
  run 8080 $ cors (const $ Just policy) $ serve api (makeServer conn)
