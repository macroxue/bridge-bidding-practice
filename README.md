# Bridge Bidding Practice

One player bids all four hands, practicing and tuning any systems.

## Auction

[<img src="./auction-layout.png" width="100%">](https://macroxue.github.io/bridge-bidding-practice/practice.html)

* Navigate up to 1000 boards per browser per device. Boards are stored in the
  browser's local storage. Clearing the local storage erases all boards saved
  with the browser.
* Only the hand to bid/call is shown during an auction.
* Notes can be added to each board.
* Invalid bidding buttons are either greyed out or hidden.

## Analysis

[<img src="./analysis-layout.png" width="100%">](https://macroxue.github.io/bridge-bidding-practice/practice.html)

When the auction of a board ends, all four hands are displayed with detailed analysis
to help the player evaluate the auction. The analysis assumes perfect bidding and
card play.
* Par score and par contract(s) assuming perfect bidding by all seats.
* Double-dummy (DD) results assuming perfect card play by all seats.

Three kinds of DD analysis are performed.
* For opening leads of this contract, shown as green numbers under the leading
  seat's cards. In the picture, 3NT can't be defeated. A club lead holds it to
  three and all other leads result in 3NT+1.
* For contracts in each strain declared by every seat, shown in the DD result
  table. When two seats in a partnership take the same number of tricks, only
  one number is shown; otherwise, two numbers are shown. In the picture, South as
  the declarer of an NT contract takes 9 tricks but North can take only 5 tricks;
  either South or North take 11 tricks when declaring a spade contract.
  Therefore, the best strain to play in is spade rather than NT.
* Average results when defenders' cards are randomized, shown at the bottom of
  the page. Since it's very expensive to compute such results, they're
  precomputed and retrieved from this
  [double-dummy dataset](https://github.com/macroxue/double-dummy).
  For example, either South or North can take 10 tricks with spade trumps 46%
  of the time, while 3NT can make only 17% of the time. This result, although
  without considering the actual auction, still shows spade is a better
  strain than NT. From the numbers one can also see that it's better for South
  to declare than North.

## Filtering

When filtering is toggled on, filters below are applied to the boards.
* Noted: auctions with a manually entered note.
* Ended: auctions that have ended.
* Auction: auctions that match a regular expression.

Auctions and boards can be filtered by patterns using JavaScript's regular
expressions. Refer to
[JAVASCRIPT.INFO](https://javascript.info/regular-expressions)
for technical details.

The vocabulary of auctions is limited to 38 calls.
* 35 bids: "[1-7][NSHDC]"
* 3 special calls: "[PXR]" where P, X and R stand for pass, double and redouble
  respectively.

An auction is represented by a simple concatenation of all of its calls.
For example, the auction below is represented by this searchable string
"P1S2DXR2S3DPPP". No spaces are needed as there is no ambiguity.

   | W  | N  | E | S  |
   |----|----|---|----|
   |    |    |   | P  |
   | 1S | 2D | X | XX |
   | 2S | 3D | P | P  |
   | P  |

Below are some regular expressions looking for patterns in auctions.
* "P{4}" or "PPPP": passed out.
* "^P*1[HS]": opening one of a major.
* "^P*1.1.X": negative double.
* "^P*1(.)X2\1X": responsive double.
* "3NPPP": ending with a 3NT contract.
* "NP*XPPP": ending with a doubled NT contract.

