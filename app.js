import { HOP_abi, HOP_address, USDT_abi, USDT_address, exchange_abi, exchange_address } from "./abi_address.js"

window.onload = async () => {
    window.app = {};
    window.app.update = {}
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
    window.app.current_account = accounts[0];

    let network = await web3.eth.net.getNetworkType();
    $("#network_type").html(network)
    window.app.hop = new web3.eth.Contract(HOP_abi, HOP_address)
    window.app.usdt = new web3.eth.Contract(USDT_abi, USDT_address)
    window.app.exchange = new web3.eth.Contract(exchange_abi, exchange_address)
    
    await injectContractBaseInfo()

    if (window.app.current_account == window.app.owner) {
        $("#contract_owner").show()
    }
    if (window.app.current_account == window.app.fundAddress) {
        $("#hop_woner").show()
    }
    $("#owner_addr").html(window.app.owner)
    $("#fund_addr").html(window.app.fundAddress)
    
    let now = (new Date()).getTime()/1000;
    let width = getProgress(now)+'%'
    $("#progress").css('width', width)
    $('#progress_hop').html(width)

    ethereum.on('accountsChanged', async () => {
        location.reload()
    })

    ethereum.on('chainChanged', async () => {
        location.reload()
    })

    //init
    await syncBalance()
    showExchangeRate()
    handleTime()
    attachEvents()
}

async function injectContractBaseInfo(){
    let p1 = window.app.exchange.methods.mutiplier().call()
    let p2 = window.app.exchange.methods.HOP_FUND().call()
    let p3 = window.app.exchange.methods.owner().call()
    let p4 = window.app.hop.methods.totalSupply().call()
    let p5 = window.app.exchange.methods.EXCHANGE_END_TIME().call()
    let p6 = window.app.exchange.methods.ONLINE_TIME().call()
    let values = await Promise.all([p1, p2, p3, p4, p5, p6])
    window.app.mutipler = values[0]
    window.app.fundAddress = values[1]
    window.app.owner = values[2]
    window.app.totalHop = values[3]
    window.app.exchangeEndTime = values[4] * 1000
    window.app.onlineTime = values[5] * 1000
}

function handleTime() {
    const st = new Date(window.app.exchangeEndTime)
    const rt = new Date(window.app.onlineTime);
    let stop_time = formatDate(st)
    let release_time = formatDate(rt)
    $("#stop_time").html(stop_time)
    $("#release_time").html(release_time)

    // let now = (new Date()).getTime();
    // if (now > window.app.stopTime * 1000) {
    //     $("#exchange").attr('disabled', true)
    //     $("#exchange").css("background", "#AAACAD")
    // }
    // if (now < window.app.releaseTime * 1000) {
    //     $("#claim").attr('disabled', true)
    //     $("#claim").css("background", "#AAACAD")
    // }
}

function getProgress(current){
    let day = 24 * 60 * 60
    if (current < window.app.exchangeEndTime + day /2){
        return 0
    }
    if (current < window.app.onlineTime){
        return 20
    }
    let period = (current - window.app.onlineTime) / (30 * day) + 1
    if(period >= 12) {
        return 100
    }
    let p = Math.floor(period)
    return 20 + p * (80 / 12)
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

async function syncBalance() {
    {
        let account = window.app.current_account
        let p1 = window.app.hop.methods.balanceOf(account).call()
        let p2 = window.app.usdt.methods.balanceOf(account).call()
        let p3 = window.app.exchange.methods.balanceDetail(account).call()
        let values = await Promise.all([p1,p2,p3])
        window.app.hopBalance = values[0]
        window.app.usdtBalance = values[1]
        window.app.balanceDetail = values[2]

        $("#hop_balance").html(window.app.hopBalance / 1e18 + "")
        $("#usdt_balance").html(window.app.usdtBalance / 1e6 + "")
        $("#Total_balance").html(window.app.balanceDetail.totalBalance / 1e18 + "")
    }
}

function showExchangeRate() {
    $("#rate").html(window.app.mutipler / 1e12)
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
            await window.app.usdt.methods.approve(exchange_address, totalSupply).send({ from: address })
        }
        window.app.exchange.methods.exchangeForHOP(cost).send({ from: address }).then(async () => {
            alert("exchange succeed!")
            syncBalance()
        })
    })

    $("#claim").click(async () => {
        window.app.exchange.methods.claimHOP().send({ from: window.app.current_account }).then(async () => {
            alert("claim succeed!")
            syncBalance()
        })
    })

    $("#approve_hop").click(() => {
        window.app.hop.methods.approve(exchange_address, window.app.totalHop).send({ from: window.app.fundAddress })
            .then(async () => {
                alert("approve success!")
            })
    })

    $("#set_rate").click(() => {
        let r = $("#new_rate").val()
        window.app.exchange.methods.setRate(r).send({ from: window.app.owner })
            .then(async () => {
                alert("rate changed!")
                await showExchangeRate()
            })
    })

    $("#change_address").click(() => {
        let f_address = $("#f_addr").val()
        let b_address = $("#b_addr").val()
        window.app.exchange.methods.changeAddress(f_address, b_address).send({ from: window.app.owner })
            .then(() => {
                alert("address changed, please reload")
            })
    })

    $("#append").click(() => {
        let address = $("#append_address").val()
        if (!web3.utils.isAddress(address)){
            alert("not an address!")
            return
        }
        if (address in window.app.update){
            alert("address already inserted!")
            return
        }
        let value = new BN($("#append_value").val()).mul(new BN(1e9)).mul(new BN(1e9)).toString()
        let text = $("#sell_record").val()
        if(text != ""){
            text = text + "\n"
        }
        text = text+ address + "\t" + value.toString()
        $("#sell_record").val(text)
        $("#append_address").val("")
        $("#append_value").val("")
        //reconstruct update
        let lines = text.split("\n")
        window.app.update = {}
        for(var index in lines){
            let line = lines[index]
            let pair = line.split("\t")
            let addr = pair[0]
            let balance = pair[1]
            if(addr in window.app.update){
                alert("address already inserted")
                return
            }
            window.app.update[addr] = balance
        }
    }) 

    $("#update").click(() => {
        let text = $("#sell_record").val()
        let lines = text.split("\n")
        window.app.update = {}
        for(var index in lines){
            let line = lines[index]
            let pair = line.split("\t")
            let addr = pair[0]
            let balance = pair[1]
            if(addr in window.app.update){
                alert("address already inserted")
                return
            }
            window.app.update[addr] = balance
        }
        let addr_array = []
        let val_array = []
        for (var a in window.app.update){
            addr_array.push(a)
            val_array.push(window.app.update[a])
        } 
        let address = window.app.current_account
        window.app.exchange.methods.editBalance(addr_array, val_array).send({ from: address }).then(()=>{
            alert("data inserted")
        })
    })
}