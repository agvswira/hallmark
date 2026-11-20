// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {HallmarkRegistry} from "../src/HallmarkRegistry.sol";

/// @notice Deploys HallmarkRegistry. The deployer becomes owner; the verifier is
///         HALLMARK_VERIFIER if set, otherwise the deployer itself.
contract DeployRegistry is Script {
    function run() external returns (HallmarkRegistry registry) {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(key);
        address verifier = vm.envOr("HALLMARK_VERIFIER", deployer);

        vm.startBroadcast(key);
        registry = new HallmarkRegistry(verifier);
        vm.stopBroadcast();

        console.log("HallmarkRegistry", address(registry));
        console.log("owner", deployer);
        console.log("verifier", verifier);
    }
}
