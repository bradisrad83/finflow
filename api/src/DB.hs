{-# LANGUAGE OverloadedStrings  #-}
{-# OPTIONS_GHC -Wno-orphans    #-}

module DB where

import Control.Monad          (when)
import Data.Text              (Text)
import Database.SQLite.Simple
import Types

-- ---------------------------------------------------------------------------
-- FromRow instances — how sqlite-simple maps a result row to a Haskell value
-- ---------------------------------------------------------------------------

instance FromRow Account where
  fromRow = Account
    <$> field
    <*> field
    <*> (accountTypeFromText <$> field)
    <*> field

instance FromRow Transaction where
  fromRow = Transaction
    <$> field
    <*> field
    <*> field
    <*> field
    <*> (transactionTypeFromText <$> field)
    <*> field
    <*> field

-- ---------------------------------------------------------------------------
-- Text <-> sum type helpers
-- ---------------------------------------------------------------------------

accountTypeFromText :: Text -> AccountType
accountTypeFromText "checking" = Checking
accountTypeFromText _          = Savings

accountTypeToText :: AccountType -> Text
accountTypeToText Checking = "checking"
accountTypeToText Savings  = "savings"

transactionTypeFromText :: Text -> TransactionType
transactionTypeFromText "credit" = Credit
transactionTypeFromText _        = Debit

transactionTypeToText :: TransactionType -> Text
transactionTypeToText Credit = "credit"
transactionTypeToText Debit  = "debit"

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

initDB :: Connection -> IO ()
initDB conn = do
  execute_ conn
    "CREATE TABLE IF NOT EXISTS accounts \
    \(id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, balance REAL NOT NULL)"
  execute_ conn
    "CREATE TABLE IF NOT EXISTS transactions \
    \(id TEXT PRIMARY KEY, account_id TEXT NOT NULL, description TEXT NOT NULL, \
    \amount REAL NOT NULL, type TEXT NOT NULL, date TEXT NOT NULL, category TEXT NOT NULL)"
  seedIfEmpty conn

seedIfEmpty :: Connection -> IO ()
seedIfEmpty conn = do
  [Only n] <- query_ conn "SELECT COUNT(*) FROM accounts" :: IO [Only Int]
  when (n == 0) $ do
    mapM_ (insertAccount conn) seedAccounts
    mapM_ (insertTransaction conn) seedTransactions

-- ---------------------------------------------------------------------------
-- Queries
-- ---------------------------------------------------------------------------

getAccounts :: Connection -> IO [Account]
getAccounts conn =
  query_ conn "SELECT id, name, type, balance FROM accounts"

getTransactionsByAccount :: Connection -> Text -> IO [Transaction]
getTransactionsByAccount conn aid =
  query conn
    "SELECT id, account_id, description, amount, type, date, category \
    \FROM transactions WHERE account_id = ?"
    (Only aid)

insertAccount :: Connection -> Account -> IO Account
insertAccount conn acc = do
  execute conn "INSERT INTO accounts (id, name, type, balance) VALUES (?,?,?,?)"
    ( accountId acc
    , accountName acc
    , accountTypeToText (accountType acc)
    , accountBalance acc
    )
  return acc

insertTransaction :: Connection -> Transaction -> IO Transaction
insertTransaction conn txn = do
  execute conn
    "INSERT INTO transactions \
    \(id, account_id, description, amount, type, date, category) \
    \VALUES (?,?,?,?,?,?,?)"
    ( transactionId txn
    , transactionAccountId txn
    , transactionDescription txn
    , transactionAmount txn
    , transactionTypeToText (transactionType txn)
    , transactionDate txn
    , transactionCategory txn
    )
  return txn

removeTransaction :: Connection -> Text -> IO ()
removeTransaction conn tid =
  execute conn "DELETE FROM transactions WHERE id = ?" (Only tid)

updateTransaction :: Connection -> Transaction -> IO Transaction
updateTransaction conn txn = do
  execute conn
    "UPDATE transactions SET description = ?, amount = ?, type = ?, category = ? WHERE id = ?"
    ( transactionDescription txn
    , transactionAmount txn
    , transactionTypeToText (transactionType txn)
    , transactionCategory txn
    , transactionId txn
    )
  return txn

updateAccount :: Connection -> Account -> IO Account
updateAccount conn acc = do
  execute conn "UPDATE accounts SET name = ? WHERE id = ?" (accountName acc, accountId acc)
  return acc

removeAccount :: Connection -> Text -> IO ()
removeAccount conn aid = do
  execute conn "DELETE FROM transactions WHERE account_id = ?" (Only aid)
  execute conn "DELETE FROM accounts WHERE id = ?" (Only aid)

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
