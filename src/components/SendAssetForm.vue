<template>
    <div id="buyasset" class="mb-5">
        <h3>Buy VACoin</h3>
        <div
            v-if="this.acsTxId !== ''"
            class="alert alert-success"
            role="alert"
        >
            Txn Ref:
            <a :href="explorerURL" target="_blank">{{ this.acsTxId }}</a>
        </div>
        <p>Total allocated tokens: {{ this.total_allocated_tokens }}</p>
        <p>You can withdraw only: {{ this.amount_left }}</p>
        <form
            action="#"
            @submit.prevent="handleBuyAsset"
        >
            <div class="mb-3">
                <label for="asset_amount" class="form-label"
                    >Buy amount</label
                >
                <input
                    type="number"
                    class="form-control"
                    id="asset_amount"
                    v-model="asset_amount"
                />
            </div>
            <button type="submit" class="btn btn-primary">Buy</button>
        </form>
    </div>
</template>

<script>
import * as helpers from '../helpers';
import algosdk from 'algosdk';
import contractsConfig from '../artifacts/mint_asset.js.cp.yaml';
import { getAlgodClient } from "../client.js";
import wallets from "../wallets.js";

export default {
    props: {
        connection: String,
        network: String,
        sender: String,
        amount_left: Number,
        total_allocated_tokens: Number,
    },

    data() {
        return {
            acsTxId: "",
            asset_amount: 0,
            explorerURL: "",
            algodClient: null,
            vestingAppAddress: null,
            vestingAppID: null,
            VACoinID: null,
        };
    },
    created(){
        this.algodClient = getAlgodClient(this.network),
        this.vestingAppAddress = contractsConfig.default.metadata.VestingAppAddress
        this.vestingAppID = contractsConfig.default.metadata.VestingAppId
        this.VACoinID = contractsConfig.default.metadata.vacoinid
        this.asset_amount=0
    },


    methods: {
        async updateAmount() {
            this.$emit("setAmountLeft", this.sender);
        },
        async updateTxn(value) {
            this.acsTxId = value;
            this.explorerURL = helpers.getExplorerURL(this.acsTxId, this.network);
        },

        async handleBuyAsset() {
            
            let params = await this.algodClient.getTransactionParams().do();
            params.fee = 1000;
            params.flatFee = true;

            const senderInfoResponse = await this.algodClient.accountInformation(this.sender).do();

            for(let i =0; i <= senderInfoResponse.assets.length; i++){
               
                if(typeof senderInfoResponse.assets[i] === 'undefined' ||(senderInfoResponse.assets[i]['asset-id'] !== this.VACoinID && i >= senderInfoResponse.assets.length - 1)){
                    let optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParams(this.sender,this.sender, undefined, undefined, 0,undefined,this.VACoinID, params);
                    await wallets.sendAlgoSignerGTransaction([optInTxn], this.algodClient);
                    break;
                } 
                if(senderInfoResponse.assets[i]['asset-id'] === this.VACoinID){
                    break;
                }

            }

            let appArgs = [new Uint8Array(Buffer.from("withdrawFromVesting")), algosdk.encodeUint64(Number(this.asset_amount))];

            let transferAssetTxn = algosdk.makeApplicationNoOpTxn(this.sender, params, this.vestingAppID,appArgs,undefined,undefined,[this.VACoinID]);
            let payFees = algosdk.makePaymentTxnWithSuggestedParams(this.sender, 
                this.vestingAppAddress, 
                1000, 
                undefined, 
                undefined, 
                params);

                  
            // Store txns
            let txns = [payFees, transferAssetTxn];
            // Assign group ID
            algosdk.assignGroupID(txns);
            const a = await wallets.sendAlgoSignerGTransaction(txns, this.algodClient);
            if (Object.keys(a).length == 1) {
                this.updateTxn(a.txId) 
                this.updateAmount()

            } else {
                alert("ERROR: "+a.message);
            }
        },
    },
};
</script>
