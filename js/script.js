// configuring web3js
if (typeof web3 !== 'undefined')  {
	web3 = new Web3(web3.currentProvider);
} else {
	web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
}
web3.eth.defaultAccount = web3.eth.accounts[0];
abiDecoder.addABI(abi);
var BlockchainSplitwiseContractSpec = web3.eth.contract(abi);
var BlockchainSplitwise = BlockchainSplitwiseContractSpec.at(contractAddress)

function getUserTransactions(user){
    var nTfs = BlockchainSplitwise.getTransactionsCount(user).toNumber();
    var transfers = []
    for (i =0; i<nTfs; i++){
        transfers.push(BlockchainSplitwise.getIthDebit(user, i));
    }
    return transfers;
}


// To get Users that are involved in some unsettled transaction
function getUnsettledUsers(addressOfContract) {
    var users = new Set();
    var nTfs = BlockchainSplitwise.LatestTransferIndex().toNumber();
    for (i = 1; i<=nTfs; i++){
        if (!BlockchainSplitwise.isSettled(i)){
            users.add(BlockchainSplitwise.getTransasctionDebtor(i));
            users.add(BlockchainSplitwise.getTransactionCreditor(i));
        }
    }
	return Array.from(users); 
}


function getTotalToGive(user) {
    var owed = 0;
    getUserTransactions(user)
        .map(function (t) {
            
                owed += BlockchainSplitwise.getTransactionAmount(t).toNumber();

            
        })
    return owed;
}

function getTotalGain(user){

    var togain = 0;
    
    var nTfs = BlockchainSplitwise.LatestTransferIndex().toNumber();
    for (i = 1; i<=nTfs; i++){
        if (!BlockchainSplitwise.isSettled(i)){
            // users.add(BlockchainSplitwise.getTransasctionDebtor(i));
            // users.add(BlockchainSplitwise.getTransactionCreditor(i));

            if(user === BlockchainSplitwise.getTransactionCreditor(i)){

                togain += BlockchainSplitwise.getTransactionAmount(i).toNumber();

            }

        }
    }
	return togain
    
}

// Last Active Time of Wallter
function getLastTimeActive(user) {
    var lastIndex = BlockchainSplitwise.getTransactionsCount(user).toNumber()-1;
    if (lastIndex < 0 ) return null;

    var lastTransferId = BlockchainSplitwise.getIthDebit(user, lastIndex);
    return BlockchainSplitwise.getTransferTimeStamp(lastTransferId).toNumber();
}


function addNewTransaction(creditor, amount) {
    var sender = $("#myaccount").find(":selected").text();
    var path = BreadthFirstSearch(creditor, sender);
    if (path == null || path.length == 0){
        addNewTransactionFinal(sender, creditor, amount);
        debugger_log(sender.substring(38,42) + "---"+amount+"--->" + creditor.substring(38,42));
    } else {
        debugger_log("cycle detected: ", path);
        var history = [{id: -1, value: parseInt(amount, 10)}];
        for (i = path.length-1; i>0; i--){
            history.push({
                id: BlockchainSplitwise.getTransactionHistory(path[i-1], path[i]).toNumber(),
                value: BlockchainSplitwise.amountOwed(path[i-1], path[i]).toNumber()
            });
        }
        debugger_log("history", history);
        history.sort((a,b) => a.value - b.value);
        debugger_log("sorted", history);

        if (history[0].id == -1){
            for (i=1; i<history.length; i++){
                BlockchainSplitwise.modifyTransaction(history[i].id, history[0].value);
            }
            getSortedHistory(path, 0);
        } else {
            // modify minimum transaction
            BlockchainSplitwise.modifyTransaction(history[0].id, history[0].value);
            // add new transaction with the subtracted amount
            addNewTransactionFinal(sender, creditor, amount-history[0].value);
            
            // replace existed transaction with the subtracted amount
            for (i=1; i<history.length; i++){
                if (history[i].id == -1) continue;
                BlockchainSplitwise.modifyTransaction(
                    history[i].id, 
                    history[0].value
                );
            }
            getSortedHistory(path, amount-history[0].value);
        }
    }
}

function addNewTransactionFinal(debtor, creditor, amount){
    debugger_log("IOU "+ web3.eth.defaultAccount + " "+ " " + creditor + " " + amount, null)
    BlockchainSplitwise.addTransaction.sendTransaction(creditor, amount,
        {
            from: debtor,
            gas: 1000000
        });
}

function getSortedHistory(path, amount){
    var history = [{id: -1, value: parseInt(amount, 10)}];
    for (i = path.length-1; i>0; i--){
        history.push({
            id: BlockchainSplitwise.getTransactionHistory(path[i-1], path[i]).toNumber(),
            value: BlockchainSplitwise.amountOwed(path[i-1], path[i]).toNumber()
        });
    }
    debugger_log("history", history);
    history.sort((a,b) => a.value - b.value);
    debugger_log("sorted", history);
    return history;
}


function BreadthFirstSearch(start, end) {
	var queue = [[start]];
	while (queue.length > 0) {
		var cur = queue.shift();
		var lastNode = cur[cur.length-1]
		if (lastNode === end) {
			return cur;
		} else {
			// var neighbors = getNeighbors(lastNode);
            var neighbors = [];
            getUserTransactions(lastNode)
                .map(function (t) {
                    neighbors.push(BlockchainSplitwise.getTransactionCreditor(t));
                })
            // return neighbours;
			for (var i = 0; i < neighbors.length; i++) {
				queue.push(cur.concat([neighbors[i]]));
			}
		}
	}
	return null;
}

function debugger_log(description, obj) {
    if (debugging){
        var logData = description + ": " + (obj !== null ? JSON.stringify(obj, null, 2): "") + "\n\n"; 
        $("#log").html($("#log").html() + logData);
    }
}

function data(id){

    var data_final = []


    data_final.push(BlockchainSplitwise.getTransasctionDebtor(id))
    data_final.push(BlockchainSplitwise.getTransactionCreditor(id))
    data_final.push(BlockchainSplitwise.getTransactionAmount(id))
    data_final.push(BlockchainSplitwise.getTransactionSlab(id))

    return data_final

}

function getFinalList(user){

    var list = []
    var nTfs = BlockchainSplitwise.LatestTransferIndex().toNumber();
    for (i = 1; i<=nTfs; i++){
        if (!BlockchainSplitwise.isSettled(i)){
            // users.add(BlockchainSplitwise.getTransasctionDebtor(i));
            // users.add(BlockchainSplitwise.getTransactionCreditor(i));

            if(user === BlockchainSplitwise.getTransactionCreditor(i) || user === BlockchainSplitwise.getTransasctionDebtor(i)){

                list.push(i)
                
            }

        }
    }

    return list
}