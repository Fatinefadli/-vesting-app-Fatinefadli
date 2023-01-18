const { types } = require("@algo-builder/web");
const { assert, expect } = require("chai");
const { Runtime, AccountStore, ERRORS } = require("@algo-builder/runtime");
const commonfn = require("./commonfn");

describe("Success Flow", function () {
    // Write your code here
    let master;
    let runtime;
    let appInfoMint;
    let accounts;

    // do this before each test
    this.beforeEach(async function () {
        master = new AccountStore(10000000e6); //10_000_000 Algos
        advisors = new AccountStore(10000000e6);
        privateInvestors = new AccountStore(10000000e6);
        companyReserves = new AccountStore(10000000e6);
        team = new AccountStore(10000000e6);
        runtime = new Runtime([master,advisors,privateInvestors,companyReserves,team]);
    });

    

    it("Deploys create (mint) contract successfully", () => {
        appInfoMint = commonfn.initMint(runtime,master.account);
        const appID = appInfoMint.appID;

        // verify app created
        assert.isDefined(appID);

        // verify app funded
        const appAccount = runtime.getAccount(appInfoMint.applicationAccount);
        assert.equal(appAccount.amount, 5e7);// 50 algos

    });

    
    it("asset created successfully", () => {
        appInfoMint = commonfn.initMint(runtime,master.account);
        const assetID = commonfn.createAsset(runtime,master.account,appInfoMint.appID);

        // verify assetID
        assert.isDefined(assetID);

    });


    it("Deploys vesting contract successfully", () => {
        appInfoMint = commonfn.initMint(runtime,master.account);
        const assetID = commonfn.createAsset(runtime,master.account,appInfoMint.appID);
        accounts = [advisors.account.addr, privateInvestors.account.addr, companyReserves.account.addr, team.account.addr];
        const appInfo = commonfn.initVesting(runtime,master.account,accounts,assetID);
        const appID = appInfo.appID;

        // verify app created
        assert.isDefined(appID);

        // verify app funded
        const appAccount = runtime.getAccount(appInfo.applicationAccount);
        assert.equal(appAccount.amount, 5e7);
    }).timeout(10000);


    it("Vesting contract opts in successfully", () => {
        appInfoMint = commonfn.initMint(runtime,master.account);
        const assetID = commonfn.createAsset(runtime,master.account,appInfoMint.appID);
        accounts = [advisors.account.addr, privateInvestors.account.addr, companyReserves.account.addr, team.account.addr];
        const appInfo = commonfn.initVesting(runtime,master.account,accounts,assetID);

        // do opt in
        commonfn.optIn(runtime, master.account, appInfo.appID, assetID);

    }).timeout(10000);

    it("Transfer to vesting contract successfully" , () => {
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
        commonfn.transfer(runtime, 
            "transferVesting", 
            75_000_000, 
            master.account,
            appInfoMint.appID, 
            appInfoVesting.applicationAccount,
            assetID
            );

        const appAccount = runtime.getAccount(appInfoVesting.applicationAccount);
      
        assert.equal(Number(appAccount.assets.get(assetID).amount),75_000_000);

    }).timeout(10000);

    it("Withdraw 50% on month 13" , () => {
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
            
        let timesTamp = 13 * 2629743 + 604800 ; // 402 days, 16 hours, 17 minutes and 39 seconds.
        runtime.setRoundAndTimestamp(40, timesTamp) // month 13

        //
        // for advisors, total allocated: 10_000_000
        // in the month 13: 12/24*10_000_000 = 5_000_000, he can withdraw only 5_000_000
        // 
        const amountOfAsset = 5_000_000;

        commonfn.withdraw(runtime, 
            advisors.account, 
            assetID, 
            appInfoVesting,
            amountOfAsset)

        
    }).timeout(100000)


    it("Withdraw full amount on month 25" , () => {
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
            
        // The getTime method returns the time in milliseconds.
        let timesTamp = 26 * 2629800; // 791 days, 9 hours, 0 minutes and 0 seconds
        runtime.setRoundAndTimestamp(40, timesTamp) // month 25

        //
        // for advisors, total allocated: 10_000_000 VAC
        // in the month 13: 2/24*10_000_000 - totalAllocated = 10_000_000 assume that totalAllocated = 0 (0 Txn within vesting period)
        // he can withdraw  10_000_000 VAC
        // 
        const amountOfAsset = 10_000_000;

        commonfn.withdraw(runtime, 
            advisors.account, 
            assetID, 
            appInfoVesting,
            amountOfAsset)

        
    }).timeout(100000)
    it("Withdraw 50% on month 13" , () => {
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
            
        let timesTamp = 13 * 2629743 + 604800 ; // 402 days, 16 hours, 17 minutes and 39 seconds.
        runtime.setRoundAndTimestamp(40, timesTamp) // month 13

        //
        // for advisors, total allocated: 10_000_000
        // in the month 13: 12/24*10_000_000 = 5_000_000, he can withdraw only 5_000_000
        // 
        const amountOfAsset = 5_000_000;

        commonfn.withdraw(runtime, 
            advisors.account, 
            assetID, 
            appInfoVesting,
            amountOfAsset)

        
    }).timeout(100000)


    it("Reserves account can withdraw full amount at start" , () => {
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

            //optI asset from companyReserves
            runtime.executeTx({
                type: types.TransactionType.OptInASA,
                sign: types.SignType.SecretKey,
                fromAccount: companyReserves.account,
                assetID: assetID,
                payFlags: { totalFee: 1000 },
            })
        
        const amountOfAsset = 30_000_000;

        commonfn.withdraw(runtime, 
            companyReserves.account, 
            assetID, 
            appInfoVesting,
            amountOfAsset)

        
    }).timeout(100000)
    

});
