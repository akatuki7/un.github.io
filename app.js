import { HOP_abi, HOP_address, USDT_abi, USDT_address, exchange_abi, exchange_address } from "./abi_address.js"

document.addEventListener('DOMContentLoaded',function(){
    console.log('appjs DOMContentLoaded');
});

(() => {
    console.log("() appjs");
})();

// (async ()=>{
//     if (window.ethereum) {
//         window.web3 = new Web3(ethereum)
//     }
//     $("#network").click(async () => {
//         await start()
//     })
// })()

window.onload = async () => {
    console.log("window.onload");
    window.app = {};
    $("#network").click(async () => {
        await start()
    })
}


async function start() {
    // Modern dApp browsers...
    if (window.ethereum) {
        $("#broswer_type").html("modern")
        window.web3 = new Web3(ethereum)
        try {
            // await ethereum.enable()
            const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
            console.log("accounts", accounts);
        } catch (error) {
            alert(error)
        }
    }
    // Legacy dApp browsers...
    else if (window.web3) {
        $("#broswer_type").html("Legacy")
        window.web3 = new Web3(web3.currentProvider)
    }
    // Non-dApp browsers...
    else {
        $("#broswer_type").html("none")
        window.alert("Please connect to Metamask.")
    }

    window.BN = web3.utils.BN
    let accounts = await web3.eth.getAccounts();
    $("#user_address").html(accounts[0]);
    // console.log(accounts);
    window.app.current_account = accounts[0];
    let network = await web3.eth.net.getNetworkType();
    $("#network_type").html(network)
    window.app.hop = new web3.eth.Contract(HOP_abi, HOP_address)
    window.app.usdt = new web3.eth.Contract(USDT_abi, USDT_address)
    window.app.exchange = new web3.eth.Contract(exchange_abi, exchange_address)
    let p1 = window.app.exchange.methods.mutiplier().call() 
    let p2 = window.app.exchange.methods.beneficiary().call()
    let p3 = window.app.exchange.methods.fund().call()
    let p4 = window.app.exchange.methods.owner().call()
    let p5 = window.app.hop.methods.totalSupply().call()
    Promise.all([p1,p2,p3,p4,p5]).then((values)=>{
        window.app.mutipler = values[0]
        window.app.beneficiary = values[1]
        window.app.fundAddress = values[2]
        window.app.owner = values[3]
        window.app.totalHop = values[4]
    })
    if(window.app.current_account == window.app.owner) {
        $("#contract_owner").show()
    }
    if(window.app.current_account == window.app.fundAddress) {
        $("#hop_woner").show()
    }
    $("#owner_addr").html(window.app.owner)
    $("#fund_addr").html(window.app.fundAddress)

    ethereum.on('accountsChanged', async () => {
        location.reload()
    })

    ethereum.on('chainChanged', async () => {
        location.reload()
    })

    //init
    syncBalance()
    showExchangeRate()
    await handleTime()
    attachEvents()
    await showFund()
    await showHopCredit()
}

async function handleTime() {
    window.app.stopTime = await window.app.exchange.methods.exchangeStopTime().call()
    window.app.releaseTime = await window.app.exchange.methods.releaseHopTime().call()
    const st = new Date(window.app.stopTime * 1000)
    const rt = new Date(window.app.releaseTime * 1000);
    
    let stop_time = formatDate(st)
    let release_time = formatDate(rt)
    $("#stop_time").html(stop_time)
    $("#release_time").html(release_time)

    let now = (new Date()).getTime();
    if (now > window.app.stopTime * 1000) {
        $("#exchange").attr('disabled', true)
        $("#exchange").css("background","#AAACAD")
    }
    if (now < window.app.releaseTime * 1000) {
        $("#claim").attr('disabled', true)
        $("#claim").css("background","#AAACAD")
    }
}

function formatDate(now) {
    var year = now.getFullYear();
    var month = now.getMonth() + 1;
    var date = now.getDate();
    var hour = now.getHours();
    var minute = now.getMinutes();
    var second = now.getSeconds();
    return year + "-" + month + "-" + date + " " + hour + ":" + minute + ":" + second;
}

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
        window.app.exchange.methods.HOPCredit(account).call().then(
            (x) => {
                $("#credit_balance").html(x / 1e18 + "" )
            }
        )
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

async function showHopCredit() {
    let credit = await window.app.exchange.methods.HOPCredit(window.app.current_account).call()
    console.log("credit", credit);
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
        let number = new BN($("#input_usdt").val())
        let balance = new BN($("#usdt_balance").html())

        if (number.gt(balance)) {
            alert("not enough USDT!")
            return
        }
        let cost = number.mul(new BN(1e6))
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

    $("#claim").click(async () => {
        window.app.exchange.methods.claimHOP().send({from: window.app.current_account}).then(async () => {
            alert("claim succeed!")
            syncBalance()
        })
    })

    $("#approve_hop").click(()=>{
        window.app.hop.methods.approve(exchange_address, window.app.totalHop).send({from: window.app.fundAddress})
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