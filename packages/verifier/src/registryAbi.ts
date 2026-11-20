// Generated from contracts/out/HallmarkRegistry.sol/HallmarkRegistry.json (forge build).
export const hallmarkRegistryAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "initialVerifier",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "MAX_TEXT_LENGTH",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ML_DSA_87",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "PQC_KEY_STATUS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "PQC_USES_KEY_STATUS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "PQC_USES_VERIFY",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "claim",
    "inputs": [
      {
        "name": "target",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "repo",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "claimOf",
    "inputs": [
      {
        "name": "target",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct HallmarkRegistry.Claim",
        "components": [
          {
            "name": "claimant",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "claimedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "possessionProven",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "repo",
            "type": "string",
            "internalType": "string"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "count",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hallmarkOf",
    "inputs": [
      {
        "name": "target",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct HallmarkRegistry.Hallmark",
        "components": [
          {
            "name": "matchType",
            "type": "uint8",
            "internalType": "enum HallmarkRegistry.Match"
          },
          {
            "name": "pqcFlags",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "verifiedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "deployer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "runtimeCodeHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "sourceHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "compiler",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "sourceUri",
            "type": "string",
            "internalType": "string"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isCurrent",
    "inputs": [
      {
        "name": "target",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "recordVerification",
    "inputs": [
      {
        "name": "target",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "matchType",
        "type": "uint8",
        "internalType": "enum HallmarkRegistry.Match"
      },
      {
        "name": "pqcFlags",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "deployer",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "sourceHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "compiler",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "sourceUri",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setVerifier",
    "inputs": [
      {
        "name": "newVerifier",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "targets",
    "inputs": [
      {
        "name": "start",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "limit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "page",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "verifier",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "ClaimCleared",
    "inputs": [
      {
        "name": "target",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "formerClaimant",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Claimed",
    "inputs": [
      {
        "name": "target",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "claimant",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "repo",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "possessionProven",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Hallmarked",
    "inputs": [
      {
        "name": "target",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "matchType",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum HallmarkRegistry.Match"
      },
      {
        "name": "pqcFlags",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "deployer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "runtimeCodeHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "sourceHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "compiler",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "sourceUri",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "VerifierChanged",
    "inputs": [
      {
        "name": "previousVerifier",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newVerifier",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "Downgrade",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidMatch",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidPqcFlags",
    "inputs": [
      {
        "name": "flags",
        "type": "uint8",
        "internalType": "uint8"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidText",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoCode",
    "inputs": [
      {
        "name": "target",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "NoPqcKey",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "NotDeployer",
    "inputs": [
      {
        "name": "caller",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "deployer",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "NotHallmarked",
    "inputs": [
      {
        "name": "target",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "NotOwner",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotVerifier",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PqcUnavailable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  }
] as const;
