/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/lendingprogram.json`.
 */
export type Lendingprogram = {
  "address": "DDy97mgfJ6pkGzF4KdaVVXpKkVFFBgn4EGdZ7EbrH5rB",
  "metadata": {
    "name": "lendingprogram",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Lending and Borrowing Protocol for Planet Whiskey NFTs"
  },
  "instructions": [
    {
      "name": "addCollection",
      "docs": [
        "Add a collection to the registry"
      ],
      "discriminator": [
        79,
        172,
        225,
        142,
        219,
        192,
        171,
        80
      ],
      "accounts": [
        {
          "name": "collectionRegistry",
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
                  110,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "address": "2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk"
        }
      ],
      "args": [
        {
          "name": "collectionMint",
          "type": "pubkey"
        },
        {
          "name": "valueUsd",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addLiquidity",
      "docs": [
        "Add liquidity to the protocol (admin only)"
      ],
      "discriminator": [
        181,
        157,
        89,
        67,
        143,
        182,
        52,
        72
      ],
      "accounts": [
        {
          "name": "globalMarket",
          "writable": true
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "liquidityAmountUsd",
          "type": "u64"
        }
      ]
    },
    {
      "name": "closeCollectionRegistry",
      "docs": [
        "Close Collection Registry (Emergency Admin Function)"
      ],
      "discriminator": [
        107,
        212,
        98,
        37,
        246,
        112,
        213,
        87
      ],
      "accounts": [
        {
          "name": "collectionRegistry",
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
                  110,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "address": "2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk"
        }
      ],
      "args": []
    },
    {
      "name": "depositNft",
      "docs": [
        "Deposit NFT to increase borrowing power"
      ],
      "discriminator": [
        93,
        226,
        132,
        166,
        141,
        9,
        48,
        101
      ],
      "accounts": [
        {
          "name": "globalMarket",
          "writable": true
        },
        {
          "name": "collectionRegistry",
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
                  110,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "borrowerAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  114,
                  114,
                  111,
                  119,
                  101,
                  114,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "nftMint"
        },
        {
          "name": "userNftAccount",
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
          "name": "nftEscrow",
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
                  97,
                  116,
                  101,
                  114,
                  97,
                  108,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "nftMint"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "nftMetadata"
        },
        {
          "name": "tokenMetadataProgram"
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
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "collectionMint",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initializeCapitalVault",
      "docs": [
        "Initialize the lending program's capital vault"
      ],
      "discriminator": [
        168,
        123,
        174,
        219,
        245,
        182,
        124,
        87
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalMarket",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "capitalVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  112,
                  105,
                  116,
                  97,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  117,
                  115,
                  100,
                  99
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
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
      "name": "initializeCollectionRegistry",
      "docs": [
        "Manage approved NFT collections with their USD values (only treasury wallet can call)",
        "Initialize the main collection registry"
      ],
      "discriminator": [
        67,
        46,
        195,
        231,
        11,
        87,
        70,
        204
      ],
      "accounts": [
        {
          "name": "collectionRegistry",
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
                  110,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeCollectionRegistryV2",
      "docs": [
        "Initialize Collection Registry V2 (with different seeds)"
      ],
      "discriminator": [
        36,
        5,
        148,
        143,
        175,
        68,
        134,
        223
      ],
      "accounts": [
        {
          "name": "collectionRegistry",
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
                  110,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeGlobalMarket",
      "docs": [
        "Initialize the global market (Project Constellation Master Setup)"
      ],
      "discriminator": [
        67,
        173,
        52,
        201,
        74,
        169,
        150,
        163
      ],
      "accounts": [
        {
          "name": "globalMarket",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "collectionRegistry",
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
                  110,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "capitalVaultUsdc"
        },
        {
          "name": "treasuryWallet"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "maxStakedNfts",
          "type": "u32"
        },
        {
          "name": "perNftValueUsd",
          "type": "u64"
        }
      ]
    },
    {
      "name": "makeInterestPayment",
      "docs": [
        "Make interest payment (WHISKEY TOKENS ONLY - goes to treasury)"
      ],
      "discriminator": [
        220,
        2,
        56,
        126,
        239,
        204,
        9,
        192
      ],
      "accounts": [
        {
          "name": "loan",
          "writable": true
        },
        {
          "name": "borrowerAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  114,
                  114,
                  111,
                  119,
                  101,
                  114,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "borrower"
              }
            ]
          }
        },
        {
          "name": "globalMarket",
          "writable": true
        },
        {
          "name": "borrowerWhiskeyTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "borrower"
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
                "kind": "const",
                "value": [
                  83,
                  235,
                  167,
                  178,
                  139,
                  209,
                  2,
                  119,
                  85,
                  199,
                  159,
                  50,
                  48,
                  155,
                  131,
                  44,
                  241,
                  202,
                  228,
                  224,
                  215,
                  76,
                  78,
                  22,
                  226,
                  220,
                  156,
                  124,
                  62,
                  15,
                  77,
                  108
                ]
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
          "name": "treasuryWhiskeyTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasuryWallet"
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
                "kind": "const",
                "value": [
                  83,
                  235,
                  167,
                  178,
                  139,
                  209,
                  2,
                  119,
                  85,
                  199,
                  159,
                  50,
                  48,
                  155,
                  131,
                  44,
                  241,
                  202,
                  228,
                  224,
                  215,
                  76,
                  78,
                  22,
                  226,
                  220,
                  156,
                  124,
                  62,
                  15,
                  77,
                  108
                ]
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
          "name": "treasuryWallet",
          "writable": true
        },
        {
          "name": "borrower",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "paymentAmountWhiskey",
          "type": "u64"
        },
        {
          "name": "currentWhiskeyPriceUsd",
          "type": "u64"
        }
      ]
    },
    {
      "name": "processMintRevenue",
      "docs": [
        "Process mint revenue split (80% to lending, 20% to treasury)"
      ],
      "discriminator": [
        26,
        190,
        106,
        52,
        66,
        86,
        75,
        225
      ],
      "accounts": [
        {
          "name": "globalMarket"
        },
        {
          "name": "revenueSource",
          "writable": true
        },
        {
          "name": "capitalVaultUsdc",
          "writable": true
        },
        {
          "name": "treasuryWhiskeyTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasuryWallet"
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
                "kind": "const",
                "value": [
                  83,
                  235,
                  167,
                  178,
                  139,
                  209,
                  2,
                  119,
                  85,
                  199,
                  159,
                  50,
                  48,
                  155,
                  131,
                  44,
                  241,
                  202,
                  228,
                  224,
                  215,
                  76,
                  78,
                  22,
                  226,
                  220,
                  156,
                  124,
                  62,
                  15,
                  77,
                  108
                ]
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
          "name": "treasuryWallet",
          "writable": true
        },
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "totalRevenueWhiskey",
          "type": "u64"
        }
      ]
    },
    {
      "name": "takeLoan",
      "docs": [
        "Take a loan against deposited NFTs"
      ],
      "discriminator": [
        153,
        53,
        51,
        59,
        222,
        102,
        52,
        131
      ],
      "accounts": [
        {
          "name": "globalMarket",
          "writable": true
        },
        {
          "name": "borrowerAccount",
          "writable": true
        },
        {
          "name": "loan",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  111,
                  97,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "borrower"
              },
              {
                "kind": "account",
                "path": "borrower_account.loan_counter",
                "account": "borrowerAccount"
              }
            ]
          }
        },
        {
          "name": "assetMint"
        },
        {
          "name": "capitalVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  112,
                  105,
                  116,
                  97,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  117,
                  115,
                  100,
                  99
                ]
              }
            ]
          }
        },
        {
          "name": "treasuryTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasuryWallet"
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
                "path": "assetMint"
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
          "name": "treasuryWallet",
          "writable": true
        },
        {
          "name": "borrowerTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "borrower"
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
                "path": "assetMint"
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
          "name": "borrower",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "loanAmountUsd",
          "type": "u64"
        },
        {
          "name": "durationSecs",
          "type": "u32"
        }
      ]
    },
    {
      "name": "toggleCollectionApproval",
      "docs": [
        "Toggle collection approval status"
      ],
      "discriminator": [
        108,
        203,
        227,
        188,
        221,
        211,
        231,
        203
      ],
      "accounts": [
        {
          "name": "collectionRegistry",
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
                  110,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "address": "2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk"
        }
      ],
      "args": [
        {
          "name": "collectionMint",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "triggerLiquidationAuction",
      "docs": [
        "Trigger liquidation (both conditions: expired OR collateral value drop)"
      ],
      "discriminator": [
        181,
        172,
        83,
        88,
        101,
        55,
        246,
        111
      ],
      "accounts": [
        {
          "name": "borrowerAccount",
          "writable": true
        },
        {
          "name": "globalMarket"
        },
        {
          "name": "nftAuction",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  102,
                  116,
                  95,
                  97,
                  117,
                  99,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "borrowerAccount"
              }
            ]
          }
        },
        {
          "name": "liquidator",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "liquidationReason",
          "type": {
            "defined": {
              "name": "liquidationReason"
            }
          }
        }
      ]
    },
    {
      "name": "updateAdminSettings",
      "docs": [
        "Update admin settings (only treasury wallet can call)",
        "Now includes ALL configurable GlobalMarket parameters"
      ],
      "discriminator": [
        10,
        27,
        52,
        103,
        217,
        27,
        114,
        12
      ],
      "accounts": [
        {
          "name": "globalMarket",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "address": "2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk"
        }
      ],
      "args": [
        {
          "name": "newBaseInterestRate1MonthBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "newBaseInterestRate2MonthBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "newBaseInterestRate3MonthBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "newOptimalUtilizationRateBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "newMaxInterestRateMultiplierBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "newUtilizationSlope1Bps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "newUtilizationSlope2Bps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "newLoanToValueRatioBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "newTransactionFeeBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "newLendingWalletShareBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "newTreasuryWalletShareBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "newMaxStakedNfts",
          "type": {
            "option": "u32"
          }
        },
        {
          "name": "newPerNftValueUsd",
          "type": {
            "option": "u64"
          }
        }
      ]
    },
    {
      "name": "updateCollectionValue",
      "docs": [
        "Update a collection's USD value"
      ],
      "discriminator": [
        68,
        167,
        164,
        239,
        233,
        122,
        76,
        117
      ],
      "accounts": [
        {
          "name": "collectionRegistry",
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
                  110,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "address": "2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk"
        }
      ],
      "args": [
        {
          "name": "collectionMint",
          "type": "pubkey"
        },
        {
          "name": "newValueUsd",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawNft",
      "docs": [
        "Withdraw NFT after full loan repayment"
      ],
      "discriminator": [
        142,
        181,
        191,
        149,
        82,
        175,
        216,
        100
      ],
      "accounts": [
        {
          "name": "globalMarket",
          "writable": true
        },
        {
          "name": "collectionRegistry",
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
                  110,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "borrowerAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  114,
                  114,
                  111,
                  119,
                  101,
                  114,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "nftMint"
        },
        {
          "name": "userNftAccount",
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
          "name": "nftEscrow",
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
                  97,
                  116,
                  101,
                  114,
                  97,
                  108,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "nftMint"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "borrowerAccount",
      "discriminator": [
        36,
        64,
        147,
        86,
        52,
        110,
        151,
        126
      ]
    },
    {
      "name": "collectionRegistry",
      "discriminator": [
        103,
        157,
        231,
        9,
        181,
        43,
        15,
        106
      ]
    },
    {
      "name": "globalMarket",
      "discriminator": [
        21,
        240,
        53,
        82,
        138,
        209,
        110,
        149
      ]
    },
    {
      "name": "loan",
      "discriminator": [
        20,
        195,
        70,
        117,
        165,
        227,
        182,
        1
      ]
    },
    {
      "name": "nftAuction",
      "discriminator": [
        198,
        128,
        54,
        35,
        103,
        212,
        3,
        98
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorizedTreasuryAccess",
      "msg": "Unauthorized treasury wallet access"
    },
    {
      "code": 6001,
      "name": "invalidStakedNftsLimit",
      "msg": "Invalid staked NFTs limit (must be 500-10,000)"
    },
    {
      "code": 6002,
      "name": "invalidInterestRate",
      "msg": "Invalid interest rate (must be 2.5%-25%)"
    },
    {
      "code": 6003,
      "name": "invalidTransactionFee",
      "msg": "Invalid transaction fee (must be 1%-5%)"
    },
    {
      "code": 6004,
      "name": "maxStakedNftsTooLow",
      "msg": "Max staked NFTs too low (below current staked)"
    },
    {
      "code": 6005,
      "name": "globalCollateralLimitReached",
      "msg": "Global collateral limit reached"
    },
    {
      "code": 6006,
      "name": "userNftLimitReached",
      "msg": "User NFT limit reached (max 5)"
    },
    {
      "code": 6007,
      "name": "invalidNftOwnership",
      "msg": "Invalid NFT ownership"
    },
    {
      "code": 6008,
      "name": "invalidLoanDuration",
      "msg": "Invalid loan duration"
    },
    {
      "code": 6009,
      "name": "insufficientBorrowingPower",
      "msg": "Insufficient borrowing power"
    },
    {
      "code": 6010,
      "name": "insufficientProtocolLiquidity",
      "msg": "Insufficient protocol liquidity"
    },
    {
      "code": 6011,
      "name": "loanNotActive",
      "msg": "Loan not active"
    },
    {
      "code": 6012,
      "name": "invalidPaymentAmount",
      "msg": "Invalid payment amount"
    },
    {
      "code": 6013,
      "name": "excessivePaymentAmount",
      "msg": "Excessive payment amount"
    },
    {
      "code": 6014,
      "name": "loanNotDefaultable",
      "msg": "Loan not defaultable"
    },
    {
      "code": 6015,
      "name": "collateralValueSufficient",
      "msg": "Collateral value sufficient"
    },
    {
      "code": 6016,
      "name": "invalidUtilizationRate",
      "msg": "Invalid utilization rate (must be 50%-95%)"
    },
    {
      "code": 6017,
      "name": "invalidRateMultiplier",
      "msg": "Invalid rate multiplier (must be 1x-5x)"
    },
    {
      "code": 6018,
      "name": "invalidLtvRatio",
      "msg": "Invalid LTV ratio (must be 40%-90%)"
    },
    {
      "code": 6019,
      "name": "invalidNftValue",
      "msg": "Invalid NFT value (must be greater than 0)"
    },
    {
      "code": 6020,
      "name": "invalidNftMetadata",
      "msg": "Invalid NFT metadata account"
    },
    {
      "code": 6021,
      "name": "invalidNftCollection",
      "msg": "NFT is not from an approved collection"
    },
    {
      "code": 6022,
      "name": "tooManyCollections",
      "msg": "Too many collections (max 10)"
    },
    {
      "code": 6023,
      "name": "noCollectionsProvided",
      "msg": "No collections provided"
    },
    {
      "code": 6024,
      "name": "unauthorizedAdmin",
      "msg": "Unauthorized: Caller is not the admin wallet"
    },
    {
      "code": 6025,
      "name": "collectionAlreadyExists",
      "msg": "Collection already exists in registry"
    },
    {
      "code": 6026,
      "name": "collectionNotFound",
      "msg": "Collection not found in registry"
    },
    {
      "code": 6027,
      "name": "registryFull",
      "msg": "Registry is full (max 100 collections per registry)"
    },
    {
      "code": 6028,
      "name": "invalidUtilizationSlope",
      "msg": "Invalid utilization slope (must be <= 100% for slope1, <= 200% for slope2)"
    },
    {
      "code": 6029,
      "name": "invalidRevenueSplit",
      "msg": "Invalid revenue split percentage (must be <= 100%)"
    },
    {
      "code": 6030,
      "name": "invalidRevenueSplitTotal",
      "msg": "Revenue split percentages must add up to exactly 100%"
    },
    {
      "code": 6031,
      "name": "outstandingDebtExists",
      "msg": "Outstanding debt exists - cannot withdraw NFT"
    },
    {
      "code": 6032,
      "name": "nftNotDeposited",
      "msg": "NFT not found in deposited collateral"
    },
    {
      "code": 6033,
      "name": "invalidWhiskeyPrice",
      "msg": "Invalid WHISKEY price (must be greater than 0)"
    },
    {
      "code": 6034,
      "name": "insufficientPaymentAmount",
      "msg": "Insufficient payment amount (WHISKEY value less than debt)"
    },
    {
      "code": 6035,
      "name": "invalidAssetMint",
      "msg": "Invalid asset mint for capital vault"
    },
    {
      "code": 6036,
      "name": "invalidVaultAuthority",
      "msg": "Invalid vault authority - must be global market PDA"
    }
  ],
  "types": [
    {
      "name": "auctionStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "completed"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "borrowerAccount",
      "docs": [
        "Borrower Account - Consolidates each user's position (Project Constellation)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "globalMarket",
            "type": "pubkey"
          },
          {
            "name": "depositedNfts",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "activeLoans",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "totalBorrowingPowerUsd",
            "type": "u128"
          },
          {
            "name": "totalDebtUsd",
            "type": "u128"
          },
          {
            "name": "loanCounter",
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
      "name": "collectionEntry",
      "docs": [
        "Individual Collection Entry"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "valueUsd",
            "type": "u64"
          },
          {
            "name": "isApproved",
            "type": "bool"
          },
          {
            "name": "addedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "collectionRegistry",
      "docs": [
        "Collection Registry - Scalable collection management (Option 2: Multiple Registry Accounts)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "collections",
            "type": {
              "vec": {
                "defined": {
                  "name": "collectionEntry"
                }
              }
            }
          },
          {
            "name": "nextRegistry",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "globalMarket",
      "docs": [
        "Global Market State - Project Constellation Master Account"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "capitalVaultUsdc",
            "type": "pubkey"
          },
          {
            "name": "treasuryWallet",
            "type": "pubkey"
          },
          {
            "name": "collectionRegistry",
            "type": "pubkey"
          },
          {
            "name": "maxStakedNfts",
            "type": "u32"
          },
          {
            "name": "currentStakedNfts",
            "type": "u32"
          },
          {
            "name": "perNftValueUsd",
            "type": "u64"
          },
          {
            "name": "baseInterestRate1MonthBps",
            "type": "u16"
          },
          {
            "name": "baseInterestRate2MonthBps",
            "type": "u16"
          },
          {
            "name": "baseInterestRate3MonthBps",
            "type": "u16"
          },
          {
            "name": "maxInterestRateMultiplierBps",
            "type": "u16"
          },
          {
            "name": "optimalUtilizationRateBps",
            "type": "u16"
          },
          {
            "name": "utilizationSlope1Bps",
            "type": "u16"
          },
          {
            "name": "utilizationSlope2Bps",
            "type": "u16"
          },
          {
            "name": "totalLiquidityAvailableUsd",
            "type": "u128"
          },
          {
            "name": "totalLiquidityBorrowedUsd",
            "type": "u128"
          },
          {
            "name": "transactionFeeBps",
            "type": "u16"
          },
          {
            "name": "lendingWalletShareBps",
            "type": "u16"
          },
          {
            "name": "treasuryWalletShareBps",
            "type": "u16"
          },
          {
            "name": "loanToValueRatioBps",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "liquidationReason",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "termExpired"
          },
          {
            "name": "collateralValueDrop"
          }
        ]
      }
    },
    {
      "name": "loan",
      "docs": [
        "Individual Loan Account - Links to BorrowerAccount"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "borrowerAccount",
            "type": "pubkey"
          },
          {
            "name": "principalAmountUsd",
            "type": "u64"
          },
          {
            "name": "borrowedAssetMint",
            "type": "pubkey"
          },
          {
            "name": "startTs",
            "type": "i64"
          },
          {
            "name": "durationSecs",
            "type": "u32"
          },
          {
            "name": "gracePeriodEndsTs",
            "type": "i64"
          },
          {
            "name": "interestRateAtOriginationBps",
            "type": "u16"
          },
          {
            "name": "interestPaidUsd",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "loanStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "loanStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "defaulted"
          },
          {
            "name": "repaid"
          }
        ]
      }
    },
    {
      "name": "nftAuction",
      "docs": [
        "NFT Auction Account - For liquidated NFTs"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nftMint",
            "type": "pubkey"
          },
          {
            "name": "startingPriceUsd",
            "type": "u64"
          },
          {
            "name": "currentBidUsd",
            "type": "u64"
          },
          {
            "name": "highestBidder",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "auctionEndTs",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "auctionStatus"
              }
            }
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
