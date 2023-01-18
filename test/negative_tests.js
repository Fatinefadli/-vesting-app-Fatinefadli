const { types } = require("@algo-builder/web");
const { assert} = require("chai");
const { convert} = require("@algo-builder/algob");
const { Runtime, AccountStore, ERRORS } = require("@algo-builder/runtime");
const commonfn = require("./commonfn");

const RUNTIME_ERR1009 = 'RUNTIME_ERR1009: TEAL runtime encountered err opcode';
const RUNTIME_ERR1007 = "RUNTIME_ERR1007: Teal code rejected by logic";

describe("Negative Tests", function () {
    let master;
    let runtime;
    let appInfoMint;
    let accounts;
    let non_stake;

    // do this before each test
    this.beforeEach(async function () {
        master = new AccountStore(10000000e6); //10_000_000 Algos
        advisors = new AccountStore(10000000e6);
        privateInvestors = new AccountStore(10000000e6);
        companyReserves = new AccountStore(10000000e6);
        team = new AccountStore(10000000e6);
        non_stake = new AccountStore(10000000e7);
        runtime = new Runtime([master,advisors,privateInvestors,companyReserves,team,non_stake]);
    });
    
    it("Double asset creation fails", () => {
        appInfoMint = commonfn.initMint(runtime,master.account);
        
        // create asste 
        const assetID = commonfn.createAsset(runtime,master.account,appInfoMint.appID);

        // create asste again
        assert.throws(() => { const assetID = commonfn.createAsset(runtime,master.account,appInfoMint.appID) }, RUNTIME_ERR1009);
    });

    it("Asset creation fails when non-creator calls", () => {
        appInfoMint = commonfn.initMint(runtime,master.account);
        
        // create asste 
        assert.throws(() => { const assetID = commonfn.createAsset(runtime,advisors.account,appInfoMint.appID) }, RUNTIME_ERR1009);
    });

    it("Transfer to vesting contract fails when non-creator calls" , () => {
        appInfoMint = commonfn.initMint(runtime,master.account);
        const assetID = commonfn.createAsset(runtime,master.account,appInfoMint.appID);
        accounts = [advisors.account.addr, privateInvestors.account.addr, companyReserves.account.addr, team.account.addr];
        const appInfoVesting = commonfn.initVesting(runtime,master.account,accounts,assetID);
        commonfn.saveAccounts(runtime,
            master.account,
            appInfoMint.appID,
            appInfoVesting.applicationAccount);

        // do opt in
        commonfn.optIn(runtime, master.account, appInfoVesting.appID, assetID);

        assert.throws(() => { commonfn.transfer(runtime, 
            "transferVesting", 
            75_000_000, 
            advisors.account,
            appInfoMint.appID, 
            appInfoVesting.applicationAccount,
            assetID
        ) }, RUNTIME_ERR1009);
    }).timeout(10000);

    it("Transfer 75% of VACoin to non vesting app fails" , () => {
        appInfoMint = commonfn.initMint(runtime,master.account);
        const assetID = commonfn.createAsset(runtime,master.account,appInfoMint.appID);
        accounts = [advisors.account.addr, privateInvestors.account.addr, companyReserves.account.addr, team.account.addr];
        const appInfoVesting = commonfn.initVesting(runtime,master.account,accounts,assetID);
        commonfn.saveAccounts(runtime,
            master.account,
            appInfoMint.appID,
            appInfoVesting.applicationAccount);

        // do opt in
        commonfn.optIn(runtime, master.account, appInfoVesting.appID, assetID);

        assert.throws(() => { commonfn.transfer(runtime, 
            "transferVesting", 
            75_000_000,
            master.account,
            appInfoMint.appID,
            appInfoMint.applicationAccount,
            assetID
        ) }, RUNTIME_ERR1009);


    }).timeout(10000);

    it("Withdraw fails when month <= 12 " , () => {
        appInfoMint = commonfn.initMint(runtime,master.account);
        const assetID = commonfn.createAsset(runtime,master.account,appInfoMint.appID);
        accounts = [advisors.account.addr, privateInvestors.account.addr, companyReserves.account.addr, team.account.addr];
        const appInfoVesting = commonfn.initVesting(runtime,master.account,accounts,assetID);
        commonfn.saveAccounts(runtime,
            master.account,
            appInfoMint.appID,
            appInfoVesting.applicationAccount
        );


        // do opt in
        commonfn.optIn(runtime, master.account, appInfoVesting.appID, assetID);
        commonfn.transfer(runtime, 
            "transferVesting", 
            75_000_000, 
            master.account,
            appInfoMint.appID, 
            appInfoVesting.applicationAccount,
            assetID
        );

        //optI asset from advisors
        runtime.executeTx({
            type: types.TransactionType.OptInASA,
            sign: types.SignType.SecretKey,
            fromAccount: advisors.account,
            assetID: assetID,
            payFlags: { totalFee: 1000 },
        })

        let timesTamp = 3 * 2629743; // 3 month
        runtime.setRoundAndTimestamp(40, timesTamp)
        
        const amountOfAsset = 3_000_000;
        assert.throws(() =>{
            commonfn.withdraw(runtime, 
                advisors.account, 
                assetID, 
                appInfoVesting,
                amountOfAsset)}, 
                RUNTIME_ERR1007);

    }).timeout(10000);

    it("Withdraw fails when an amount exceeding their accumulated allocation for that month" , () => {
        appInfoMint = commonfn.initMint(runtime,master.account);
        const assetID = commonfn.createAsset(runtime,master.account,appInfoMint.appID);
        accounts = [advisors.account.addr, privateInvestors.account.addr, companyReserves.account.addr, team.account.addr];
        const appInfoVesting = commonfn.initVesting(runtime,master.account,accounts,assetID);
        commonfn.saveAccounts(runtime,
            master.account,
            appInfoMint.appID,
            appInfoVesting.applicationAccount,
        );

        // do opt in
        commonfn.optIn(runtime, master.account, appInfoVesting.appID, assetID);
        commonfn.transfer(runtime, 
            "transferVesting", 
            75_000_000, 
            master.account,
            appInfoMint.appID, 
            appInfoVesting.applicationAccount,
            assetID
        );

        //optI asset from advisors
        runtime.executeTx({
            type: types.TransactionType.OptInASA,
            sign: types.SignType.SecretKey,
            fromAccount: advisors.account,
            assetID: assetID,
            payFlags: { totalFee: 1000 },
        })

        let timesTamp = 13 * 2629743 + 604800 ; // 402 days, 16 hours, 17 minutes and 39 seconds.
        runtime.setRoundAndTimestamp(60, timesTamp)
        
        //
        // for advisor total allocated: 10_000_000 VAC
        // in the month 13: 12/24*10_000_000 = 5_000_000, he can withdraw only 5_000_000 VAC
        // 

        const amountOfAsset = 7_000_000;
      

            assert.throws(() =>{
                commonfn.withdraw(runtime, 
                    advisors.account, 
                    assetID, 
                    appInfoVesting,
                    amountOfAsset)}, 
                RUNTIME_ERR1009);
    
        }).timeout(10000);

    it("Withdraw fails when an amount exceeding their accumulated allocation for that month, if they have already withdrawn a partial amount" , () => {
        appInfoMint = commonfn.initMint(runtime,master.account);
        const assetID = commonfn.createAsset(runtime,master.account,appInfoMint.appID);
        accounts = [advisors.account.addr, privateInvestors.account.addr, companyReserves.account.addr, team.account.addr];
        const appInfoVesting = commonfn.initVesting(runtime,master.account,accounts,assetID);
        commonfn.saveAccounts(runtime,
            master.account,
            appInfoMint.appID,
            appInfoVesting.applicationAccount,
        );


        // do opt in
        commonfn.optIn(runtime, master.account, appInfoVesting.appID, assetID);
        commonfn.transfer(runtime, 
            "transferVesting", 
            75_000_000, 
            master.account,
            appInfoMint.appID, 
            appInfoVesting.applicationAccount,
            assetID
        );

        //optI asset from advisors
        runtime.executeTx({
            type: types.TransactionType.OptInASA,
            sign: types.SignType.SecretKey,
            fromAccount: advisors.account,
            assetID: assetID,
            payFlags: { totalFee: 1000 },
        })

        let timesTamp = 13 * 2629743 + 604800 ; // 402 days, 16 hours, 17 minutes and 39 seconds.
        runtime.setRoundAndTimestamp(60, timesTamp)
        
        //
        // for advisor total allocated: 10_000_000 VAC
        // in the month 13: 12/24*10_000_000 = 5_000_000, he can withdraw only 5_000_000 VAC
        // 
        const amountOfAsset = 4_000_000;

        commonfn.withdraw(runtime, 
            advisors.account, 
            assetID, 
            appInfoVesting,
            amountOfAsset)

            assert.throws(() =>{
                commonfn.withdraw(runtime, 
                    advisors.account, 
                    assetID, 
                    appInfoVesting,
                    amountOfAsset)}, 
                RUNTIME_ERR1009);
    
        }).timeout(10000);

    
    it("Withdraw 0 tocken fails" , () => {
        appInfoMint = commonfn.initMint(runtime,master.account);
        const assetID = commonfn.createAsset(runtime,master.account,appInfoMint.appID);
        accounts = [advisors.account.addr, privateInvestors.account.addr, companyReserves.account.addr, team.account.addr];
        const appInfoVesting = commonfn.initVesting(runtime,master.account,accounts,assetID);
        commonfn.saveAccounts(runtime,
            master.account,
            appInfoMint.appID,
            appInfoVesting.applicationAccount
        );

        // do opt in
        commonfn.optIn(runtime, master.account, appInfoVesting.appID, assetID);
        commonfn.transfer(runtime, 
            "transferVesting", 
            75_000_000, 
            master.account,
            appInfoMint.appID, 
            appInfoVesting.applicationAccount,
            assetID
        );

        let timesTamp =  13 * 2629743 + 604800 ; // 402 days, 16 hours, 17 minutes and 39 seconds.
        runtime.setRoundAndTimestamp(40, timesTamp)
        
        //optI asset from advisors
        runtime.executeTx({
            type: types.TransactionType.OptInASA,
            sign: types.SignType.SecretKey,
            fromAccount: advisors.account,
            assetID: assetID,
            payFlags: { totalFee: 1000 },
        })

        const amountOfAsset = 0;
        assert.throws(() =>{
            commonfn.withdraw(runtime, 
                advisors.account, 
                assetID, 
                appInfoVesting,
                amountOfAsset)}, 
            RUNTIME_ERR1009);

    }).timeout(10000);

    it("Withdraw fails if there is no payment to cover inner txn fees", () => {
        appInfoMint = commonfn.initMint(runtime,master.account);
        const assetID = commonfn.createAsset(runtime,master.account,appInfoMint.appID);
        accounts = [advisors.account.addr, privateInvestors.account.addr, companyReserves.account.addr, team.account.addr];
        const appInfoVesting = commonfn.initVesting(runtime,master.account,accounts,assetID);
        commonfn.saveAccounts(runtime,
            master.account,
            appInfoMint.appID,
            appInfoVesting.applicationAccount
        );

        // do opt in
        commonfn.optIn(runtime, master.account, appInfoVesting.appID, assetID);
        commonfn.transfer(runtime, 
            "transferVesting", 
            75_000_000, 
            master.account,
            appInfoMint.appID, 
            appInfoVesting.applicationAccount,
            assetID
        );

        //optI asset from advisors
        runtime.executeTx({
            type: types.TransactionType.OptInASA,
            sign: types.SignType.SecretKey,
            fromAccount: advisors.account,
            assetID: assetID,
            payFlags: { totalFee: 1000 },
        })
        
        // The getTime method returns the time in milliseconds.
        let timesTamp = 13 * 2629800  + 2629743; // 14 month 
        runtime.setRoundAndTimestamp(40, timesTamp)

        assert.throws(() =>{
            const appArgs = [convert.stringToBytes("withdrawFromVesting"),convert.uint64ToBigEndian(10000)];
            runtime.executeTx( [
                {type: types.TransactionType.TransferAlgo,
                sign: types.SignType.SecretKey,
                fromAccount: master.account,
                toAccountAddr: appInfoVesting.applicationAccount,
                amountMicroAlgos: 0,
                payFlags: { totalFee: 1000 },
                },
                {type: types.TransactionType.CallApp,
                sign: types.SignType.SecretKey,
                fromAccount: master.account,
                appID: appInfoVesting.appID,
                payFlags: { totalFee: 1000 },
                foreignAssets: [assetID],
                appArgs: appArgs,
                }
            ]);},
        RUNTIME_ERR1009);

    }).timeout(10000);


    it("Vesting app does not opt in asset twice.", () => {
        appInfoMint = commonfn.initMint(runtime,master.account);
        const assetID = commonfn.createAsset(runtime,master.account,appInfoMint.appID);
        accounts = [advisors.account.addr, privateInvestors.account.addr, companyReserves.account.addr, team.account.addr];
        const appInfoVesting = commonfn.initVesting(runtime,master.account,accounts,assetID);
        commonfn.saveAccounts(runtime,
            master.account,
            appInfoMint.appID,
            appInfoVesting.applicationAccount
        );

        // do opt in
        commonfn.optIn(runtime, master.account, appInfoVesting.appID, assetID);
        commonfn.transfer(runtime, 
            "transferVesting", 
            75_000_000, 
            master.account,
            appInfoMint.appID, 
            appInfoVesting.applicationAccount,
            assetID
        );
        
       //refuse the opt in twice
        assert.throws(() =>{
            commonfn.optIn(runtime, master.account, appInfoVesting.appID, assetID);
        },
        RUNTIME_ERR1009);

    }).timeout(10000);


    it("Opt-in app calls can only be called by vesting app creator.", () => {
        appInfoMint = commonfn.initMint(runtime,master.account);
        const assetID = commonfn.createAsset(runtime,master.account,appInfoMint.appID);
        accounts = [advisors.account.addr, privateInvestors.account.addr, companyReserves.account.addr, team.account.addr];
        const appInfoVesting = commonfn.initVesting(runtime,master.account,accounts,assetID);
        commonfn.saveAccounts(runtime,
            master.account,
            appInfoMint.appID,
            appInfoVesting.applicationAccount
        );
    
    
        
        assert.throws(() =>{
            commonfn.optIn(runtime, advisors.account, appInfoVesting.appID, assetID);
        },
        RUNTIME_ERR1009);

    }).timeout(10000);


    it(" Opt-in call to incorrect asset ID.", () => {
        appInfoMint = commonfn.initMint(runtime,master.account);
        const assetID = commonfn.createAsset(runtime,master.account,appInfoMint.appID);
        accounts = [advisors.account.addr, privateInvestors.account.addr, companyReserves.account.addr, team.account.addr];
        const appInfoVesting = commonfn.initVesting(runtime,master.account,accounts,assetID);
        commonfn.saveAccounts(runtime,
            master.account,
            appInfoMint.appID,
            appInfoVesting.applicationAccount
        );
    

        
        assert.throws(() =>{
            commonfn.optIn(runtime, master.account, appInfoVesting.appID, 10);
        },
        RUNTIME_ERR1009);

    }).timeout(10000);


    it("Withdraw fails when non-stake holders try to withdraw." , () => {
        appInfoMint = commonfn.initMint(runtime,master.account);
        const assetID = commonfn.createAsset(runtime,master.account,appInfoMint.appID);
        accounts = [advisors.account.addr, privateInvestors.account.addr, companyReserves.account.addr, team.account.addr];
        const appInfoVesting = commonfn.initVesting(runtime,master.account,accounts,assetID);
        commonfn.saveAccounts(runtime,
            master.account,
            appInfoMint.appID,
            appInfoVesting.applicationAccount,
        );


        // do opt in
        commonfn.optIn(runtime, master.account, appInfoVesting.appID, assetID);
        commonfn.transfer(runtime, 
            "transferVesting", 
            75_000_000, 
            master.account,
            appInfoMint.appID, 
            appInfoVesting.applicationAccount,
            assetID
        );

        //optI asset from non-stake holders
        runtime.executeTx({
            type: types.TransactionType.OptInASA,
            sign: types.SignType.SecretKey,
            fromAccount: non_stake.account,
            assetID: assetID,
            payFlags: { totalFee: 1000 },
        })
        
        
        const amountOfAsset = 4_000_000;


            assert.throws(() =>{
                commonfn.withdraw(runtime, 
                    non_stake.account, 
                    assetID, 
                    appInfoVesting,
                    amountOfAsset)}, 
                RUNTIME_ERR1009);
    
        }).timeout(10000);
});
