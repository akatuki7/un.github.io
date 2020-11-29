import { HOP_abi, HOP_address, USDT_abi, USDT_address, exchange_abi, exchange_address } from "./abi_address.js"

window.onload = async () => {
    window.app = {};
    window.app.update = {}
    // $("#network").click(async () => {
    //     await start()
    // })
    await start()
}



function showMsg(str) {
    if (typeof imtoken == 'undefined') {
        alert(str)
    } else {
        imToken.callAPI('native.alert', str)
    }
}

function jumpToEtherscan(address) {
    setTimeout(() => {
        window.location = 'https://cn.etherscan.com/address/' + address + '#transactions'
    }, 3000)
}

async function sendTransaction(data, from, to, callback) {
    let params = {
        from: from,
        to: to,
        data: data
    }
    // if (typeof imtoken == 'undefined') {
    return web3.eth.sendTransaction(params)
    // .then(callback)
    //     .catch((error) => {
    //         alert(error.message);
    //     });
    // } else {
    //     imToken
    //         .callPromisifyAPI("web3.eth.sendTransaction", params)
    //         .then(callback)
    //         .catch((error) => {
    //             alert(error.message);
    //         });
    // }
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
            showMsg(error)
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
        window.showMsg("Please connect to Metamask.")
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

    let now = (new Date()).getTime();
    let width = getProgress(now) + '%'
    $("#progress").css('width', width)
    $('#progress_hop').html(width)

    //calculate new time
    let day = 24 * 60 * 60 * 1000
    let times = [window.app.exchangeEndTime + day / 2, window.app.onlineTime]
    for (var i = 0; i < 11; i++) {
        times.push(times[times.length - 1] + 30 * day)
    }
    window.app.times = times
    for (var i in times) {
        if (now < times[i])
            $("#next_release").html("下次释放HOP时间" + formatDate(new Date(times[i])))
        break;
    }

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

async function injectContractBaseInfo() {
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
}

function getProgress(current) {
    let day = 24 * 60 * 60 * 1000
    if (current < window.app.exchangeEndTime + day / 2) {
        return 0
    }
    if (current < window.app.onlineTime) {
        return 20
    }
    let period = (current - window.app.onlineTime) / (30 * day) + 1
    if (period >= 12) {
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
        let currentTime = Math.floor(Date.now() / 1000)
        let account = window.app.current_account
        let p1 = window.app.hop.methods.balanceOf(account).call()
        let p2 = window.app.usdt.methods.balanceOf(account).call()
        let p3 = window.app.exchange.methods.balanceDetail(account).call()
        let p4 = window.app.exchange.methods.accountInfo(account, currentTime).call()
        let values = await Promise.all([p1, p2, p3, p4])
        window.app.hopBalance = values[0]
        window.app.usdtBalance = values[1]
        window.app.balanceDetail = values[2]
        window.app.claimInfo = values[3]

        $("#hop_balance").html(window.app.hopBalance / 1e18 + "")
        $("#usdt_balance").html(window.app.usdtBalance / 1e6 + "")
        $("#Total_balance").html(window.app.balanceDetail.totalBalance / 1e18 + "")
        $("#claimable").html(window.app.claimInfo[2] / 1e18 + "")
        $("#wait_claim").html((window.app.claimInfo[0] - window.app.claimInfo[1]) / 1e18 + "")
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

        let number = parseInt(parseFloat($("#input_usdt").val()) * 1e6)
        let balance = window.app.usdtBalance

        if (number - balance > 0) {
            showMsg("not enough usdt")
            return
        }

        let cost = number
        let address = window.app.current_account
        let allowance = await window.app.usdt.methods.allowance(address, exchange_address).call()

        if (allowance < number) {

            showMsg("you should approve USDT first")

            let totalSupply = await window.app.usdt.methods._totalSupply().call()
            try {
                window.app.usdt.methods.approve(exchange_address, totalSupply).send({ from: address })
            } catch (error) {
                jumpToEtherscan(address)
            }
        } else {

            try {
                await window.app.exchange.methods.exchangeForHOP(cost).send({ from: address })
            } catch (error) {
                jumpToEtherscan(address)
            }
        }

    })

    $("#claim").click(async () => {
        window.app.exchange.methods.claimHOP(window.app.claimInfo[2]).send({ from: window.app.current_account }).then(async () => {
            showMsg("claim succeed!")
            syncBalance()
        })
    })

    $("#approve_hop").click(() => {
        window.app.hop.methods.approve(exchange_address, window.app.totalHop).send({ from: window.app.fundAddress })
            .then(async () => {
                showMsg("approve success!")
            })
    })

    $("#set_rate").click(() => {
        let r = $("#new_rate").val()
        window.app.exchange.methods.setRate(r).send({ from: window.app.owner })
            .then(async () => {
                showMsg("rate changed!")
                await showExchangeRate()
            })
    })

    $("#change_address").click(() => {
        let f_address = $("#f_addr").val()
        let b_address = $("#b_addr").val()
        window.app.exchange.methods.changeAddress(f_address, b_address).send({ from: window.app.owner })
            .then(() => {
                showMsg("address changed, please reload")
            })
    })

    $("#append").click(() => {
        let address = $("#append_address").val()
        if (!web3.utils.isAddress(address)) {
            showMsg("not an address!")
            return
        }
        if (address in window.app.update) {
            showMsg("address already inserted!")
            return
        }
        let value = new BN($("#append_value").val()).mul(new BN(1e9)).mul(new BN(1e9)).toString()
        let text = $("#sell_record").val()
        if (text != "") {
            text = text + "\n"
        }
        text = text + address + "\t" + value.toString()
        $("#sell_record").val(text)
        $("#append_address").val("")
        $("#append_value").val("")
        //reconstruct update
        let lines = text.split("\n")
        window.app.update = {}
        for (var index in lines) {
            let line = lines[index]
            let pair = line.split("\t")
            let addr = pair[0]
            let balance = pair[1]
            if (addr in window.app.update) {
                showMsg("address already inserted")
                return
            }
            window.app.update[addr] = balance
        }
    })

    $("#update").click(() => {
        let text = $("#sell_record").val()
        let lines = text.split("\n")
        window.app.update = {}
        for (var index in lines) {
            let line = lines[index]
            let pair = line.split("\t")
            let addr = pair[0]
            let balance = pair[1]
            if (addr in window.app.update) {
                showMsg("address already inserted")
                return
            }
            window.app.update[addr] = balance
        }
        let addr_array = []
        let val_array = []
        for (var a in window.app.update) {
            addr_array.push(a)
            val_array.push(window.app.update[a])
        }
        let address = window.app.current_account
        window.app.exchange.methods.editBalance(addr_array, val_array).send({ from: address }).then(() => {
            showMsg("data inserted")
        })
    })
}