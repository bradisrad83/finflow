{-# LANGUAGE DataKinds        #-}
{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE TypeOperators    #-}

module Main where

import Control.Monad.IO.Class      (liftIO)
import Data.IORef                  (IORef, modifyIORef, newIORef, readIORef)
import Data.Text                   (Text)
import Network.Wai.Handler.Warp    (run)
import Network.Wai.Middleware.Cors (simpleCors)
import Servant
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

getAccounts :: IORef [Account] -> Handler [Account]
getAccounts ref = liftIO $ readIORef ref

getTransactions :: IORef [Transaction] -> Text -> Handler [Transaction]
getTransactions ref aid = do
  ts <- liftIO $ readIORef ref
  return $ filter (\t -> transactionAccountId t == aid) ts

postAccount :: IORef [Account] -> Account -> Handler Account
postAccount ref acc = do
  liftIO $ modifyIORef ref (acc :)
  return acc

postTransaction :: IORef [Transaction] -> Text -> Transaction -> Handler Transaction
postTransaction ref _ txn = do
  liftIO $ modifyIORef ref (txn :)
  return txn

deleteTransaction :: IORef [Transaction] -> Text -> Handler NoContent
deleteTransaction ref tid = do
  liftIO $ modifyIORef ref (filter (\t -> transactionId t /= tid))
  return NoContent

-- ---------------------------------------------------------------------------
-- Server
-- ---------------------------------------------------------------------------

makeServer :: IORef [Account] -> IORef [Transaction] -> Server API
makeServer accountsRef transactionsRef =
       getAccounts    accountsRef
  :<|> getTransactions transactionsRef
  :<|> postAccount    accountsRef
  :<|> postTransaction transactionsRef
  :<|> deleteTransaction transactionsRef

api :: Proxy API
api = Proxy

-- ---------------------------------------------------------------------------
-- Entry point
-- ---------------------------------------------------------------------------

main :: IO ()
main = do
  accountsRef     <- newIORef seedAccounts
  transactionsRef <- newIORef seedTransactions
  putStrLn "FinFlow API running on http://localhost:8080"
  run 8080 $ simpleCors $ serve api (makeServer accountsRef transactionsRef)

-- ---------------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------------

seedAccounts :: [Account]
seedAccounts =
  [ Account { accountId = "1", accountName = "Primary Checking",   accountType = Checking, accountBalance = 12450.00 }
  , Account { accountId = "2", accountName = "Emergency Savings",  accountType = Savings,  accountBalance = 8200.50  }
  , Account { accountId = "3", accountName = "Travel Fund",        accountType = Savings,  accountBalance = 3100.75  }
  ]

seedTransactions :: [Transaction]
seedTransactions =
  [ Transaction { transactionId = "t1", transactionAccountId = "1", transactionDescription = "Whole Foods Market",     transactionAmount = 87.43,   transactionType = Debit,  transactionDate = "2026-04-18", transactionCategory = "Groceries"     }
  , Transaction { transactionId = "t2", transactionAccountId = "1", transactionDescription = "Direct Deposit - Salary", transactionAmount = 4200.00, transactionType = Credit, transactionDate = "2026-04-15", transactionCategory = "Income"        }
  , Transaction { transactionId = "t3", transactionAccountId = "1", transactionDescription = "Netflix",                transactionAmount = 15.99,   transactionType = Debit,  transactionDate = "2026-04-14", transactionCategory = "Subscriptions" }
  , Transaction { transactionId = "t4", transactionAccountId = "1", transactionDescription = "Uber",                   transactionAmount = 22.50,   transactionType = Debit,  transactionDate = "2026-04-13", transactionCategory = "Transport"     }
  , Transaction { transactionId = "t5", transactionAccountId = "2", transactionDescription = "Transfer from Checking", transactionAmount = 500.00,  transactionType = Credit, transactionDate = "2026-04-15", transactionCategory = "Transfer"      }
  , Transaction { transactionId = "t6", transactionAccountId = "2", transactionDescription = "Interest Earned",        transactionAmount = 12.34,   transactionType = Credit, transactionDate = "2026-04-01", transactionCategory = "Interest"      }
  , Transaction { transactionId = "t7", transactionAccountId = "3", transactionDescription = "Transfer from Checking", transactionAmount = 200.00,  transactionType = Credit, transactionDate = "2026-04-10", transactionCategory = "Transfer"      }
  , Transaction { transactionId = "t8", transactionAccountId = "3", transactionDescription = "Flight - JFK to LAX",   transactionAmount = 310.00,  transactionType = Debit,  transactionDate = "2026-04-08", transactionCategory = "Travel"        }
  ]
