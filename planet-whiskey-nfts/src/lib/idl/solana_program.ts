/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/whiskeyprogram.json`.
 */
export type Whiskeyprogram = {
  "address": "8uPZVD859ZxgeptYWM4oKrzjMksBD9h6hYCxQbiQjS5L",
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
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "programAdminConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  115,
                  117,
                  112,
                  101,
                  114,
                  95,
                  97,
                  100,
                  109,
                  105,
                  110
                ]
              }
            ]
          }
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
          "name": "mintPrice",
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
      "name": "initializeSuperAdmin",
      "discriminator": [
        104,
        242,
        235,
        74,
        225,
        193,
        166,
        116
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "programAdminConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  115,
                  117,
                  112,
                  101,
                  114,
                  95,
                  97,
                  100,
                  109,
                  105,
                  110
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "mintNft",
      "discriminator": [
        211,
        57,
        6,
        167,
        15,
        219,
        35,
        251
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
      "name": "programAdminConfig",
      "discriminator": [
        140,
        32,
        187,
        50,
        249,
        70,
        153,
        65
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
      "name": "unauthorizedSuperAdmin",
      "msg": "Unauthorized: Caller is not the super admin."
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
            "name": "mintPrice",
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
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "programAdminConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "superAdminKey",
            "type": "pubkey"
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

// Export the IDL constant for use with Anchor Program constructor
export const IDL: Whiskeyprogram = {
  "address": "8uPZVD859ZxgeptYWM4oKrzjMksBD9h6hYCxQbiQjS5L",
  "metadata": {
    "name": "whiskeyprogram",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "createCollection",
      "discriminator": [156, 251, 92, 54, 233, 2, 16, 82],
      "accounts": [
        { "name": "payer", "writable": true, "signer": true },
        {
          "name": "programAdminConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [112, 114, 111, 103, 114, 97, 109, 95, 115, 117, 112, 101, 114, 95, 97, 100, 109, 105, 110]
              }
            ]
          }
        },
        {
          "name": "collectionConfig",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [99, 111, 108, 108, 101, 99, 116, 105, 111, 110] },
              { "kind": "arg", "path": "name" }
            ]
          }
        },
        { "name": "collectionMint", "writable": true, "signer": true },
        { "name": "metadataAccount", "writable": true },
        { "name": "masterEditionAccount", "writable": true },
        {
          "name": "tokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "account", "path": "payer" },
              { "kind": "const", "value": [6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121, 172, 28, 180, 133, 237, 95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169] },
              { "kind": "account", "path": "collectionMint" }
            ],
            "program": { "kind": "const", "value": [140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20, 142, 13, 131, 11, 90, 19, 153, 218, 255, 16, 132, 4, 142, 123, 216, 219, 233, 248, 89] }
          }
        },
        { "name": "tokenProgram", "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { "name": "associatedTokenProgram", "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" },
        { "name": "tokenMetadataProgram", "address": "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s" },
        { "name": "systemProgram", "address": "11111111111111111111111111111111" },
        { "name": "rent", "address": "SysvarRent111111111111111111111111111111111" }
      ],
      "args": [
        { "name": "name", "type": "string" },
        { "name": "symbol", "type": "string" },
        { "name": "metadataUri", "type": "string" },
        { "name": "mintPrice", "type": "u64" },
        { "name": "itemLimit", "type": "u64" }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [175, 175, 109, 31, 13, 152, 155, 237],
      "accounts": [],
      "args": []
    },
    {
      "name": "initializeSuperAdmin",
      "discriminator": [104, 242, 235, 74, 225, 193, 166, 116],
      "accounts": [
        { "name": "payer", "writable": true, "signer": true },
        {
          "name": "programAdminConfig",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [112, 114, 111, 103, 114, 97, 109, 95, 115, 117, 112, 101, 114, 95, 97, 100, 109, 105, 110] }
            ]
          }
        },
        { "name": "systemProgram", "address": "11111111111111111111111111111111" }
      ],
      "args": []
    },
    {
      "name": "mintNft",
      "discriminator": [211, 57, 6, 167, 15, 219, 35, 251],
      "accounts": [
        { "name": "payer", "writable": true, "signer": true },
        { "name": "collectionConfig", "writable": true },
        { "name": "collectionMintAccount" },
        { "name": "nftMint", "writable": true, "signer": true },
        { "name": "nftMetadataAccount", "writable": true },
        { "name": "nftMasterEditionAccount", "writable": true },
        {
          "name": "nftTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "account", "path": "payer" },
              { "kind": "const", "value": [6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121, 172, 28, 180, 133, 237, 95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169] },
              { "kind": "account", "path": "nftMint" }
            ],
            "program": { "kind": "const", "value": [140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20, 142, 13, 131, 11, 90, 19, 153, 218, 255, 16, 132, 4, 142, 123, 216, 219, 233, 248, 89] }
          }
        },
        { "name": "collectionAuthorityReceiver", "writable": true },
        { "name": "tokenProgram", "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { "name": "associatedTokenProgram", "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" },
        { "name": "tokenMetadataProgram", "address": "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s" },
        { "name": "systemProgram", "address": "11111111111111111111111111111111" },
        { "name": "rent", "address": "SysvarRent111111111111111111111111111111111" }
      ],
      "args": [
        { "name": "nftName", "type": "string" },
        { "name": "nftSymbol", "type": "string" },
        { "name": "nftUri", "type": "string" }
      ]
    }
  ],
  "accounts": [
    { "name": "collectionConfig", "discriminator": [223, 110, 152, 160, 174, 157, 106, 255] },
    { "name": "programAdminConfig", "discriminator": [140, 32, 187, 50, 249, 70, 153, 65] }
  ],
  "errors": [
    { "code": 6000, "name": "nameTooLong", "msg": "Name too long." },
    { "code": 6001, "name": "symbolTooLong", "msg": "Symbol too long." },
    { "code": 6002, "name": "uriTooLong", "msg": "URI too long." },
    { "code": 6003, "name": "itemLimitZero", "msg": "Item limit cannot be zero." },
    { "code": 6004, "name": "unauthorizedSuperAdmin", "msg": "Unauthorized: Caller is not the super admin." },
    { "code": 6005, "name": "collectionFull", "msg": "Collection is full. No more items can be minted." },
    { "code": 6006, "name": "nftNameTooLong", "msg": "NFT Name too long." },
    { "code": 6007, "name": "nftSymbolTooLong", "msg": "NFT Symbol too long." },
    { "code": 6008, "name": "nftUriTooLong", "msg": "NFT URI too long." }
  ],
  "types": [
    {
      "name": "collectionConfig",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "authority", "type": "pubkey" },
          { "name": "collectionMint", "type": "pubkey" },
          { "name": "name", "type": "string" },
          { "name": "symbol", "type": "string" },
          { "name": "metadataUri", "type": "string" },
          { "name": "mintPrice", "type": "u64" },
          { "name": "itemLimit", "type": "u64" },
          { "name": "itemsMinted", "type": "u64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    },
    {
      "name": "programAdminConfig",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "superAdminKey", "type": "pubkey" },
          { "name": "bump", "type": "u8" }
        ]
      }
    }
  ]
};
