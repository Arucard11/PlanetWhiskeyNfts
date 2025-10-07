/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/whiskeyprogram.json`.
 */
export type Whiskeyprogram = {
  "address": "Gf4thBmzMFmhAe4yo5oZXRTiZwUeTAVsWUzo6s7LywG5",
  "metadata": {
    "name": "whiskeyprogram",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "createCollection",
      "docs": [
        "✅ EXISTING COLLECTION CREATION FUNCTIONS (Keep unchanged for backwards compatibility)"
      ],
      "discriminator": [
        156,
        251,
        92,
        54,
        233,
        2,
        16,
        82
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "address": "F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X"
        },
        {
          "name": "collectionConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  101,
                  99,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "name"
              }
            ]
          }
        },
        {
          "name": "collectionMint",
          "writable": true,
          "signer": true
        },
        {
          "name": "metadataAccount",
          "writable": true
        },
        {
          "name": "masterEditionAccount",
          "writable": true
        },
        {
          "name": "tokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "admin"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "collectionMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "tokenMetadataProgram",
          "address": "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "symbol",
          "type": "string"
        },
        {
          "name": "metadataUri",
          "type": "string"
        },
        {
          "name": "mintPriceSol",
          "type": "u64"
        },
        {
          "name": "mintPriceWhiskey",
          "type": "u64"
        },
        {
          "name": "mintPriceUsd",
          "type": "u64"
        },
        {
          "name": "itemLimit",
          "type": "u64"
        }
      ]
    },
    {
      "name": "createWhiskeyGatedCollection",
      "discriminator": [
        216,
        61,
        112,
        71,
        18,
        87,
        175,
        205
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "address": "F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X"
        },
        {
          "name": "collectionConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  101,
                  99,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "name"
              }
            ]
          }
        },
        {
          "name": "collectionMint",
          "writable": true,
          "signer": true
        },
        {
          "name": "metadataAccount",
          "writable": true
        },
        {
          "name": "masterEditionAccount",
          "writable": true
        },
        {
          "name": "tokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "admin"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "collectionMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "tokenMetadataProgram",
          "address": "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "symbol",
          "type": "string"
        },
        {
          "name": "metadataUri",
          "type": "string"
        },
        {
          "name": "requiredWhiskeyAmount",
          "type": "u64"
        },
        {
          "name": "itemLimit",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [],
      "args": []
    },
    {
      "name": "mintWhiskeyGated",
      "docs": [
        "🥃 NEW: Dedicated Whiskey-Gated Minting (No Payment Processing)",
        "This function:",
        "1. Validates user has required WHISKEY balance (doesn't spend it)",
        "2. Checks wallet hasn't already minted from this collection",
        "3. Mints NFT directly (free mint)",
        "4. Updates collection counter"
      ],
      "discriminator": [
        75,
        221,
        18,
        19,
        159,
        130,
        82,
        136
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "collectionConfig",
          "writable": true
        },
        {
          "name": "userWhiskeyAccount",
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "whiskeyMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "walletNftCounter",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  97,
                  108,
                  108,
                  101,
                  116,
                  95,
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "collection_config.collection_mint",
                "account": "collectionConfig"
              }
            ]
          }
        },
        {
          "name": "nftMint",
          "writable": true,
          "signer": true
        },
        {
          "name": "nftTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "nftMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "nftMetadataAccount",
          "writable": true
        },
        {
          "name": "nftMasterEditionAccount",
          "writable": true
        },
        {
          "name": "whiskeyMint",
          "address": "9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "tokenMetadataProgram",
          "address": "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nftName",
          "type": "string"
        },
        {
          "name": "nftSymbol",
          "type": "string"
        },
        {
          "name": "nftUri",
          "type": "string"
        }
      ]
    },
    {
      "name": "mintWithPaymentValidation",
      "docs": [
        "✅ SECURE SINGLE INSTRUCTION: Mint NFT with Payment Validation",
        "This function does EVERYTHING atomically:",
        "1. Validates payment amounts against hardcoded collection price",
        "2. Transfers USDC to hardcoded capital vault",
        "3. Transfers WHISKEY to treasury",
        "4. Mints NFT to user"
      ],
      "discriminator": [
        37,
        162,
        48,
        236,
        19,
        34,
        234,
        166
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "collectionConfig",
          "writable": true
        },
        {
          "name": "nftMint",
          "writable": true,
          "signer": true
        },
        {
          "name": "nftTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "nftMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "nftMetadataAccount",
          "writable": true
        },
        {
          "name": "nftMasterEditionAccount",
          "writable": true
        },
        {
          "name": "userUsdcAccount",
          "writable": true
        },
        {
          "name": "userWhiskeyAccount",
          "writable": true
        },
        {
          "name": "capitalVault",
          "writable": true,
          "address": "DxEz7UCRnRUPUKCvWQJLGud8eCCtMdDd4onM7HJFHcZs"
        },
        {
          "name": "treasuryWhiskeyAccount",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "tokenMetadataProgram",
          "address": "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nftName",
          "type": "string"
        },
        {
          "name": "nftSymbol",
          "type": "string"
        },
        {
          "name": "nftUri",
          "type": "string"
        },
        {
          "name": "currentWhiskeyPriceUsd",
          "type": "u64"
        },
        {
          "name": "whiskeyToTreasuryAmount",
          "type": "u64"
        },
        {
          "name": "usdcToVaultAmount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "collectionConfig",
      "discriminator": [
        223,
        110,
        152,
        160,
        174,
        157,
        106,
        255
      ]
    },
    {
      "name": "walletNftCounter",
      "discriminator": [
        43,
        236,
        244,
        4,
        66,
        57,
        133,
        11
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "nameTooLong",
      "msg": "Name too long."
    },
    {
      "code": 6001,
      "name": "symbolTooLong",
      "msg": "Symbol too long."
    },
    {
      "code": 6002,
      "name": "uriTooLong",
      "msg": "URI too long."
    },
    {
      "code": 6003,
      "name": "itemLimitZero",
      "msg": "Item limit cannot be zero."
    },
    {
      "code": 6004,
      "name": "unauthorizedAdmin",
      "msg": "Unauthorized: Caller is not the admin wallet."
    },
    {
      "code": 6005,
      "name": "collectionFull",
      "msg": "Collection is full. No more items can be minted."
    },
    {
      "code": 6006,
      "name": "nftNameTooLong",
      "msg": "NFT Name too long."
    },
    {
      "code": 6007,
      "name": "nftSymbolTooLong",
      "msg": "NFT Symbol too long."
    },
    {
      "code": 6008,
      "name": "nftUriTooLong",
      "msg": "NFT URI too long."
    },
    {
      "code": 6009,
      "name": "walletNftLimitExceeded",
      "msg": "Wallet has reached the maximum NFT limit of 5 per collection."
    },
    {
      "code": 6010,
      "name": "whiskeyGatedCollectionLimitExceeded",
      "msg": "Wallet has already minted from this whiskey-gated collection. Only 1 NFT per wallet allowed."
    },
    {
      "code": 6011,
      "name": "invalidMintPrice",
      "msg": "Invalid mint price: WHISKEY amount does not match expected USD price."
    },
    {
      "code": 6012,
      "name": "invalidWhiskeyPrice",
      "msg": "Invalid WHISKEY price: Price must be between $0.001 and $100."
    },
    {
      "code": 6013,
      "name": "invalidAmount",
      "msg": "Invalid amount specified"
    },
    {
      "code": 6014,
      "name": "insufficientFunds",
      "msg": "Insufficient funds in vault"
    },
    {
      "code": 6015,
      "name": "invalidVault",
      "msg": "Invalid vault address"
    },
    {
      "code": 6016,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6017,
      "name": "invalidTokenMint",
      "msg": "Invalid token mint - expected USDC"
    },
    {
      "code": 6018,
      "name": "invalidVaultOwner",
      "msg": "Invalid vault owner - must be owned by global market PDA"
    },
    {
      "code": 6019,
      "name": "insufficientSwapOutput",
      "msg": "Insufficient swap output"
    },
    {
      "code": 6020,
      "name": "paymentNotConfirmed",
      "msg": "Payment not confirmed"
    },
    {
      "code": 6021,
      "name": "unauthorizedUser",
      "msg": "Unauthorized user"
    },
    {
      "code": 6022,
      "name": "wrongCollection",
      "msg": "Wrong collection"
    },
    {
      "code": 6023,
      "name": "insufficientPayment",
      "msg": "Insufficient payment"
    },
    {
      "code": 6024,
      "name": "notWhiskeyGated",
      "msg": "Collection is not whiskey-gated"
    },
    {
      "code": 6025,
      "name": "insufficientWhiskeyBalance",
      "msg": "Insufficient WHISKEY balance for this gated collection"
    }
  ],
  "types": [
    {
      "name": "collectionConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "collectionMint",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "symbol",
            "type": "string"
          },
          {
            "name": "metadataUri",
            "type": "string"
          },
          {
            "name": "mintPriceSol",
            "type": "u64"
          },
          {
            "name": "mintPriceWhiskey",
            "type": "u64"
          },
          {
            "name": "mintPriceUsd",
            "type": "u64"
          },
          {
            "name": "itemLimit",
            "type": "u64"
          },
          {
            "name": "itemsMinted",
            "type": "u64"
          },
          {
            "name": "isWhiskeyGated",
            "type": "bool"
          },
          {
            "name": "requiredWhiskeyAmount",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "walletNftCounter",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "nftCount",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
