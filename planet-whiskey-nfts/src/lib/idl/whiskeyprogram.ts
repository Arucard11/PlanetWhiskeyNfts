/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/whiskeyprogram.json`.
 */
export type Whiskeyprogram = {
  "address": "3sNM6w7GBRs41o4a9X6RuECLR5ZZUsADvxpsZXM1kBU8",
  "metadata": {
    "name": "whiskeyprogram",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "createCollection",
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
      "name": "createV2Vaults",
      "discriminator": [
        144,
        219,
        251,
        43,
        217,
        172,
        18,
        249
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "address": "F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X"
        },
        {
          "name": "lendingPoolConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "whiskeyVaultV2",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "const",
                "value": [
                  119,
                  104,
                  105,
                  115,
                  107,
                  101,
                  121,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "usdcVaultV2",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  100,
                  99,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "whiskeyTokenMint",
          "address": "9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph"
        },
        {
          "name": "usdcMint",
          "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
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
      "args": []
    },
    {
      "name": "createWhiskeyGatedCollection",
      "docs": [
        "Create a whiskey-gated collection (requires WHISKEY tokens to mint, free to mint if requirements met)"
      ],
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
      "name": "initializeLendingPool",
      "discriminator": [
        236,
        76,
        136,
        68,
        196,
        14,
        9,
        177
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "address": "F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X"
        },
        {
          "name": "lendingPoolConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "whiskeyVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "const",
                "value": [
                  119,
                  104,
                  105,
                  115,
                  107,
                  101,
                  121,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "usdcVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  100,
                  99,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "whiskeyTokenMint",
          "address": "9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph"
        },
        {
          "name": "usdcMint",
          "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
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
      "args": []
    },
    {
      "name": "mintNftWithSwap",
      "discriminator": [
        218,
        165,
        34,
        83,
        34,
        24,
        247,
        95
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "collectionConfig",
          "writable": true
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
                  110,
                  102,
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
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "collectionConfig"
              }
            ]
          }
        },
        {
          "name": "collectionMintAccount"
        },
        {
          "name": "nftMint",
          "writable": true,
          "signer": true
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
          "name": "nftTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "payer"
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
          "name": "collectionAuthorityReceiver",
          "writable": true
        },
        {
          "name": "globalMarket",
          "writable": true
        },
        {
          "name": "whiskeyTokenMint",
          "address": "9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph"
        },
        {
          "name": "payerWhiskeyTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "payer"
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
                "path": "whiskeyTokenMint"
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
          "name": "lendingPoolConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "lendingPoolWhiskeyVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "const",
                "value": [
                  119,
                  104,
                  105,
                  115,
                  107,
                  101,
                  121,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "lendingPoolUsdcVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  100,
                  99,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "treasuryWhiskeyTokenAccount",
          "writable": true
        },
        {
          "name": "treasuryWallet",
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
          "name": "whiskeyAmount",
          "type": "u64"
        },
        {
          "name": "currentWhiskeyRate",
          "type": "u64"
        }
      ]
    },
    {
      "name": "transferToLendingVault",
      "docs": [
        "Transfer USDC from whiskey program's vault to lending program's capital vault"
      ],
      "discriminator": [
        53,
        174,
        193,
        213,
        58,
        214,
        62,
        211
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "lendingPoolConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "whiskeyUsdcVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  100,
                  99,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "lendingCapitalVault",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
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
      "name": "lendingPoolConfig",
      "discriminator": [
        123,
        213,
        219,
        71,
        186,
        88,
        225,
        239
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
      "name": "invalidAmount",
      "msg": "Invalid amount specified"
    },
    {
      "code": 6013,
      "name": "insufficientFunds",
      "msg": "Insufficient funds in vault"
    },
    {
      "code": 6014,
      "name": "invalidVault",
      "msg": "Invalid vault address"
    },
    {
      "code": 6015,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow"
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
      "name": "lendingPoolConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "whiskeyVault",
            "type": "pubkey"
          },
          {
            "name": "usdcVault",
            "type": "pubkey"
          },
          {
            "name": "totalWhiskeyReceived",
            "type": "u64"
          },
          {
            "name": "totalUsdcSwapped",
            "type": "u64"
          },
          {
            "name": "lastSwapTimestamp",
            "type": "i64"
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
