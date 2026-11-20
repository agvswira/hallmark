// Small contracts used by the verification tests.

export const GREETER = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract Greeter {
    uint256 public answer = 1;

    function set(uint256 v) external {
        answer = v;
    }
}
`;

// Same executable code, different source text: only the metadata hash changes.
export const GREETER_COMMENTED = GREETER.replace("contract Greeter {", "/// A friendly contract.\ncontract Greeter {");

// Different logic.
export const GREETER_CHANGED = GREETER.replace("answer = v;", "answer = v + 1;");

// Calls pqcKeyStatus through a literal address.
export const KEY_GATE = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract KeyGate {
    address constant PQC_KEY_STATUS = 0x0000000000000000000000000000000000000a02;

    function hasKey(address account) external view returns (bool) {
        (bool ok, bytes memory ret) = PQC_KEY_STATUS.staticcall(
            abi.encodeWithSignature("pqcKeyStatus(address)", account)
        );
        return ok && ret.length >= 160 && abi.decode(ret, (bool));
    }
}
`;

// Calls pqcVerify through an address passed to the constructor (an immutable):
// the literal is not in the source of the contract, only in the deployed code.
export const SIG_CHECK = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract SigCheck {
    address public immutable verifier;

    constructor(address v) {
        verifier = v;
    }

    function check(bytes calldata pk, bytes calldata sig, bytes calldata msg_) external view returns (bool) {
        (bool ok, bytes memory ret) = verifier.staticcall(
            abi.encodeWithSignature("pqcVerify(bytes,bytes,bytes)", pk, sig, msg_)
        );
        return ok && ret.length == 32 && abi.decode(ret, (bool));
    }
}
`;

export const TWO_CONTRACTS = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract Small {
    function one() external pure returns (uint256) { return 1; }
}

contract Larger {
    uint256 public a;
    uint256 public b;
    function setBoth(uint256 x, uint256 y) external { a = x; b = y; }
    function sum() external view returns (uint256) { return a + b; }
}
`;
