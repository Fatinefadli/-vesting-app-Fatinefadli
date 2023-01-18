<template>
    <nav class="navbar navbar-light bg-light">
        <div class="container-fluid">
            <a class="navbar-brand" href="#"> VACoin Dapp </a>
            <form class="d-flex">
                <div class="dropdown">
                    <button
                        class="btn btn-secondary dropdown-toggle me-2"
                        type="button"
                        id="networkBtn"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                    >
                        {{ this.network }}
                    </button>
                    <ul class="dropdown-menu" aria-labelledby="networkBtn">
                        <li><button @click="handleSetNetwork('Localhost')" class="dropdown-item" type="button">Localhost</button></li>
                        <li><button @click="handleSetNetwork('Testnet')" class="dropdown-item" type="button">Testnet</button></li>
                    </ul>
                </div>
                <div v-if="this.sender !== ''" class="dropdown">
                    <button
                        class="btn btn-primary dropdown-toggle me-2"
                        style="width: 170px;"
                        type="button"
                        id="connectWalletBtn"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                    >
                        {{truncate(this.senderName) }}
                    </button>
                    <ul class="dropdown-menu" aria-labelledby="connectWalletBtn">
                        <li><button @click="handleSetSender" class="dropdown-item" type="button">Advisors</button></li>
                        <li><button @click="handleSetSender" class="dropdown-item" type="button">Private Investor</button></li>
                        <li><button @click="handleSetSender" class="dropdown-item" type="button">Company Reserves</button></li>
                        <li><button @click="handleSetSender" class="dropdown-item" type="button">Team</button></li>
                        <li><button @click="handleDisconnectWallet" class="dropdown-item" type="button">Disconnect</button></li>
                    </ul>
                </div>
                <div v-else class="dropdown">
                    <button
                        class="btn btn-primary dropdown-toggle me-2"
                        type="button"
                        id="connectWalletBtn"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                    >
                        Connect Wallet
                    </button>
                    <ul class="dropdown-menu" aria-labelledby="connectWalletBtn">
                        <li><button @click="handleConnectMyAlgo" class="dropdown-item" type="button">MyAlgo</button></li>
                        <li><button @click="handleConnectToAlgoSigner" class="dropdown-item" type="button">AlgoSigner</button></li>
                        <li>
                            <button @click="handleConnectToWalletConnect" class="dropdown-item" type="button">WalletConnect</button>
                        </li>
                    </ul>
                </div>
            </form>
        </div>
    </nav>
</template>
<script>

export default {
    props: {
        network: String,
        sender: String,
    },
    data() {
        return {
            senderName: "Advisors",
        };
    },
    methods: {
        truncate(input) {
            if (input.length > 10) {
                return input.substring(0, 10) + "...";
            }
            return input;
        },
        handleSetNetwork(network) {
            this.$emit("setNetwork", network);
        },
        handleSetSender(event) {
            const innerText =event.target.innerText;
            let sender;

            if(innerText === "Advisors"){
                sender = process.env.VUE_APP_ACC1_ADDR;
                this.senderName = "Advisors";
            } else if(innerText === "Private Investor"){
                sender = process.env.VUE_APP_ACC3_ADDR;
                this.senderName = "Private Investor";
            } else if(innerText === "Company Reserves"){
                sender = process.env.VUE_APP_ACC2_ADDR;
                this.senderName = "Company Reserves";
            } else if(innerText === "Team"){
                sender = process.env.VUE_APP_ACC4_ADDR;
                this.senderName = "Team";
            }

            if(sender){
                this.$emit("setSender", sender);
                this.$emit("setAmountLeft", sender);
            }
        },
        handleDisconnectWallet() {
            this.$emit("disconnectWallet");
        },
        handleConnectMyAlgo() {
            this.$emit("connectMyAlgo");
        },
        handleConnectToAlgoSigner() {
            this.$emit("connectToAlgoSigner");
        },
        handleConnectToWalletConnect() {
            this.$emit("connectToWalletConnect");
        },
    },
};
</script>
