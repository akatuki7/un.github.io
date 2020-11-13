import { HOP_abi, HOP_address, USDT_abi, USDT_address, exchange_abi, exchange_address } from "./abi_address.js"

window.app = {};

(async () => {
    // Modern dApp browsers...
    if (window.ethereum) {
        $("#broswer_type").val("modern")
        window.web3 = new Web3(ethereum)
        try {
            await ethereum.enable()
        } catch (error) {
            alert(error)
        }
    }
    // Legacy dApp browsers...
    else if (window.web3) {
        $("#broswer_type").val("Legacy")
        window.web3 = new Web3(web3.currentProvider)
    }
    // Non-dApp browsers...
    else {
        $("#broswer_type").val("none")
    }
    if (typeof web3 !== 'undefined') {
        web3 = new Web3(web3.currentProvider)
    } else {
        window.alert("Please connect to Metamask.")
    }

    let accounts = await web3.eth.getAccounts();
    $("#user_address").html(accounts[0]);
    // console.log(accounts);
    window.app.current_account = accounts[0];
    let network = await web3.eth.net.getNetworkType();
    $("#network_type").html(network)
    window.app.hop = new web3.eth.Contract(HOP_abi, HOP_address)
    window.app.usdt = new web3.eth.Contract(USDT_abi, USDT_address)
    window.app.exchange = new web3.eth.Contract(exchange_abi, exchange_address)
    window.app.mutipler = await window.app.exchange.methods.mutiplier().call()
    window.app.beneficiary = await window.app.exchange.methods.beneficiary().call()
    window.app.fundAddress = await window.app.exchange.methods.fund().call() 
    window.app.owner = await window.app.exchange.methods.owner().call()
    if(window.app.current_account == window.app.owner){
        $("#contract_owner").show()
    }
    if(window.app.current_account == window.app.fundAddress){
        $("#hop_woner").show()
    }
    window.app.totalHop = await app.hop.methods.totalSupply().call()
    $("#owner_addr").html(window.app.owner)
    $("#fund_addr").html(window.app.fundAddress)


    //init
    // await showConfigs()
    syncBalance()
    showExchangeRate()
    attachEvents()
    await showFund()
})();

// async function showConfigs() {
//     let accounts = await web3.eth.getAccounts();
//     let fundAddress = await window.app.exchange.methods.fund().call();
//     let ownerAddress = await window.app.exchange.methods.owner().call();
//     console.log(account[0] == fundAddress);
//     if (account[0] == fundAddress) {
//         console.log("account[0]", accounts[0]);
//         console.log("window.app.fundAddress", fundAddress);
//         $("#hop_woner").show()
//     }
//     console.log(account[0] == ownerAddress);
//     if (account[0] == ownerAddress) {
//         console.log("account[0]", accounts[0]);
//         console.log("window.app.owner", ownerAddress);
//         $("#contract_owner").show()
//     }
// }

function syncBalance() {
    {
        let account = window.app.current_account
        window.app.hop.methods.balanceOf(account).call().then(
            (x) => {
                $("#hop_balance").html(x / 1e18 + "")
            }
        );
        window.app.usdt.methods.balanceOf(account).call().then(
            (x) => {
                $("#usdt_balance").html(x / 1e6 + "")
            }
        );
    }
}

function showExchangeRate() {
    $("#rate").html(window.app.mutipler / 1e12)
}

async function showFund() {
    let fundAddress = await window.app.exchange.methods.fund().call()
    let fundBalance = await window.app.hop.methods.balanceOf(fundAddress).call()
    let fundAllowance = await window.app.hop.methods.allowance(fundAddress, exchange_address).call()
    let remain = (fundBalance < fundAllowance ? fundBalance : fundAllowance) / 1e18
    $("#remain_hop").html(remain)
    let remain_usdt = await window.app.usdt.methods.balanceOf(window.app.beneficiary).call()
    $("#remain_usdt").html(remain_usdt / 1e6)
    $("#allowance").html(window.app.totalHop / 1e18)
}

function attachEvents() {
    $("#input_usdt").keyup(() => {
        let number = $("#input_usdt").val()
        $("#hop_amount").html(number * window.app.mutipler / 1e12)
    })

    $("#all").click(() => {
        window.app.usdt.methods.balanceOf(window.app.current_account).call().then(x => {
            $("#input_usdt").val(x / 1e6)
            $("#input_usdt").keyup()
        })
    })

    $("#exchange").click(async () => {
        let number = $("#input_usdt").val()
        if (number > $("#usdt_balance").html()) {
            alert("not enough USDT!")
            return
        }
        let cost = Math.round(number * 1e6)
        let address = window.app.current_account
        let allowance = await window.app.usdt.methods.allowance(address, exchange_address).call()
        if (allowance / 1e6 < number) {
            let totalSupply = await window.app.usdt.methods._totalSupply().call()
            await window.app.usdt.methods.approve(exchange_address, totalSupply).send({from:address})
        }
        window.app.exchange.methods.exchangeForHOP(cost).send({from:address}).then(async () => {
            alert("exchange succeed!")
            syncBalance()
            await showFund()
        })
    })

    $("#approve_hop").click(()=>{
        window.app.hop.methods.approve(exchange_address, window.app.fundBalance).send({from: window.app.fundAddress})
                    .then(async ()=>{
                        alert("approve success!")
                        await showFund()
                    })
    })

    $("#set_rate").click(()=>{
        let r = $("#new_rate").val()
        window.app.exchange.methods.setRate(r).send({from: window.app.owner})
                            .then(async ()=>{
                                alert("rate changed!")
                                await showExchangeRate()
                            })
    })

    $("#change_address").click(()=>{
        let f_address = $("#f_addr").val()
        let b_address = $("#b_addr").val()
        window.app.exchange.methods.changeAddress(f_address, b_address).send({from: window.app.owner})
                        .then(()=>{
                            alert("address changed, please reload")
                        })
    })
}