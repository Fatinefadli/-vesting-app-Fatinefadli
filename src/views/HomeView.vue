<template>
    <div>
        <NavBar
            :sender="sender"
            :network="network"
            @setAmountLeft="setAmountLeft"
            @setSender="setSender"
            @setNetwork="setNetwork"
            @disconnectWallet="disconnectWallet"
            @connectMyAlgo="connectMyAlgo"
            @connectToAlgoSigner="connectToAlgoSigner"
            @connectToWalletConnect="connectToWalletConnect"
        />
        <div id="home" class="container-sm mt-5">
            <send-asset-form
                v-if="this.sender !== ''"
                :connection="this.connection"
                :network="this.network"
                :sender="this.sender"
                :amount_left="this.amount_left"
                :total_allocated_tokens="this.total_allocated_tokens"
                @setAmountLeft="setAmountLeft"
            />
        </div>
    </div>
</template>

<script>
import MyAlgoConnect from "@randlabs/myalgo-connect";
import WalletConnect from "@walletconnect/client";
import QRCodeModal from "@walletconnect/qrcode-modal";
import { getAlgodClient } from "../client.js";
import contractsConfig from '../artifacts/mint_asset.js.cp.yaml';

export default {
    data() {
        return {
            connection: "", // myalgo | walletconnect | algosigner
            connector: null, // wallet connector obj
            network: "Localhost", // Localhost | TestNet
            sender: "", // connected account
            amount_left: 0, // Amount left for withdrawal
            total_allocated_tokens: 10_000_000,
            tokens: 0, 
        };
    },
    created(){
        this.algodClient = getAlgodClient(this.network);
        this.vestingAppID = contractsConfig.default.metadata.VestingAppId;
        this.timestamp = contractsConfig.default.metadata.VestingTimeStamp;
    },
    methods: {

        async getGlobalStates(tottalAllocated, tokensWithdrawn){
            let applicationInfoResponse = await this.algodClient.getApplicationByID(this.vestingAppID).do();
            console.log("get global states");
            let totalAllocatedTokens;
            let tokens;

            for(let i=0; i<applicationInfoResponse['params']['global-state'].length; i++){
                
                if(applicationInfoResponse['params']['global-state'][i].key === window.btoa(tottalAllocated)){
                    totalAllocatedTokens = applicationInfoResponse['params']['global-state'][i].value.uint;
                    console.log("total allocated tokens: ",totalAllocatedTokens);
                } 

                if(applicationInfoResponse['params']['global-state'][i].key === window.btoa(tokensWithdrawn)){
                    tokens = applicationInfoResponse['params']['global-state'][i].value.uint; // total tokens Withdrawn
                    console.log("tokens Withdrawn: ",tokens);
                }
            }
            return {totalAllocatedTokens,tokens}
        },

        month({totalAllocatedTokens, tokens}){
            const month = 2629800
            const currentMonth = Math.floor((Math.floor(Date.now() / 1000) - this.timestamp) / month);
            console.log("current month : ", currentMonth);
            console.log("total Allocated Tokens : ", totalAllocatedTokens);
            console.log("tokens : ", tokens);
            this.total_allocated_tokens = totalAllocatedTokens;
            if(currentMonth <= 12){
                this.amount_left = 0;
            }else if(currentMonth > 24){
                this.amount_left = totalAllocatedTokens - tokens;
            }else {
                this.amount_left = ((currentMonth - 1) * totalAllocatedTokens / 24) - tokens;
            }
        },

        async setAmountLeft(sender){
            let globalStates;
            switch(sender) {
                
                //advisors
                case process.env.VUE_APP_ACC1_ADDR:
                    globalStates = await this.getGlobalStates("AmountTotalAdvisors", "withdow_Advisors");
                    this.month(globalStates);
                    break;

                //private investors
                case process.env.VUE_APP_ACC3_ADDR:
                    globalStates = await this.getGlobalStates("AmountTotalPrivateInvestors", "withdow_PrivateInvestors");
                    this.month(globalStates);
                    break;
                
                //company reserve
                case process.env.VUE_APP_ACC2_ADDR:
                    globalStates = await this.getGlobalStates("AmountTotalCompanyReserve", "withdow_CompanyReserve");
                    this.total_allocated_tokens = globalStates.totalAllocatedTokens;
                    this.amount_left = globalStates.totalAllocatedTokens - globalStates.tokens;
                    break;

                //team
                case process.env.VUE_APP_ACC4_ADDR:
                    globalStates = await this.getGlobalStates("AmountTotalTeam", "withdow_Team");
                    this.month(globalStates);
                    break;

            }           
        },


        setNetwork(network) {
            this.disconnectWallet();
            this.network = network;
        },
        setSender(sender) {
            this.disconnectWallet();
            this.sender = sender;
        },
        disconnectWallet() {
            this.connection = ""; 
            this.connector = null;
            this.sender = "";
        },
        async connectMyAlgo() {
            try {
                // force connection to TestNet
                this.network = "TestNet";

                const myAlgoWallet = new MyAlgoConnect();
                const accounts = await myAlgoWallet.connect();
                this.sender = accounts[0].address;
                this.connection = "myalgo";
            } catch (err) {
                console.error(err);
            }
        },
        async connectToAlgoSigner() {
            const AlgoSigner = window.AlgoSigner;

            if (typeof AlgoSigner !== "undefined") {
                await AlgoSigner.connect();
                const accounts = await AlgoSigner.accounts({
                    ledger: this.network,
                });

                if (this.network === "Localhost") {
                    // use non-creator address
                    this.sender = accounts[1].address;
                } else {
                    this.sender = accounts[0].address;
                }

                this.connection = "algosigner";
            }
        },
        async connectToWalletConnect() {
            // force connection to TestNet
            this.network = "TestNet";

            // Create a connector
            this.connector = new WalletConnect({
                bridge: "https://bridge.walletconnect.org", // Required
                qrcodeModal: QRCodeModal,
            });

            // Kill existing session
            if (this.connector.connected) {
                await this.connector.killSession();
            }

            this.connector.createSession();

            // Subscribe to connection events
            this.connector.on("connect", (error, payload) => {
                if (error) {
                    throw error;
                }

                const { accounts } = payload.params[0];
                this.sender = accounts[0];
                this.connection = "walletconnect";
            });

            this.connector.on("session_update", (error, payload) => {
                if (error) {
                    throw error;
                }

                const { accounts } = payload.params[0];
                this.sender = accounts[0];
                this.connection = "walletconnect";
            });

            this.connector.on("disconnect", (error, payload) => {
                if (error) {
                    throw error;
                }

                // Delete connector
                console.log(payload);
                this.sender = "";
                this.connection = "";
            });
        },
    },
};
</script>
