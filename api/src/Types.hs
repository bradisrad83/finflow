{-# LANGUAGE OverloadedStrings #-}

module Types where

import Data.Aeson (FromJSON (..), ToJSON (..), object, withObject, withText, (.=), (.:))
import Data.Text  (Text)

-- ---------------------------------------------------------------------------
-- Account
-- ---------------------------------------------------------------------------

data AccountType = Checking | Savings

instance ToJSON AccountType where
  toJSON Checking = "checking"
  toJSON Savings  = "savings"

instance FromJSON AccountType where
  parseJSON = withText "AccountType" $ \t -> case t of
    "checking" -> pure Checking
    "savings"  -> pure Savings
    _          -> fail "expected \"checking\" or \"savings\""

data Account = Account
  { accountId      :: Text
  , accountName    :: Text
  , accountType    :: AccountType
  , accountBalance :: Double
  }

instance ToJSON Account where
  toJSON a = object
    [ "id"      .= accountId      a
    , "name"    .= accountName    a
    , "type"    .= accountType    a
    , "balance" .= accountBalance a
    ]

instance FromJSON Account where
  parseJSON = withObject "Account" $ \o -> Account
    <$> o .: "id"
    <*> o .: "name"
    <*> o .: "type"
    <*> o .: "balance"

-- ---------------------------------------------------------------------------
-- Transaction
-- ---------------------------------------------------------------------------

data TransactionType = Credit | Debit

instance ToJSON TransactionType where
  toJSON Credit = "credit"
  toJSON Debit  = "debit"

instance FromJSON TransactionType where
  parseJSON = withText "TransactionType" $ \t -> case t of
    "credit" -> pure Credit
    "debit"  -> pure Debit
    _        -> fail "expected \"credit\" or \"debit\""

data Transaction = Transaction
  { transactionId          :: Text
  , transactionAccountId   :: Text
  , transactionDescription :: Text
  , transactionAmount      :: Double
  , transactionType        :: TransactionType
  , transactionDate        :: Text
  , transactionCategory    :: Text
  }

instance ToJSON Transaction where
  toJSON t = object
    [ "id"          .= transactionId          t
    , "accountId"   .= transactionAccountId   t
    , "description" .= transactionDescription t
    , "amount"      .= transactionAmount      t
    , "type"        .= transactionType        t
    , "date"        .= transactionDate        t
    , "category"    .= transactionCategory    t
    ]

instance FromJSON Transaction where
  parseJSON = withObject "Transaction" $ \o -> Transaction
    <$> o .: "id"
    <*> o .: "accountId"
    <*> o .: "description"
    <*> o .: "amount"
    <*> o .: "type"
    <*> o .: "date"
    <*> o .: "category"
