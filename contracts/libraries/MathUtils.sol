// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import {WadRayMath} from './WadRayMath.sol';

library MathUtils {
  using WadRayMath for uint256;

  /// @dev Ignoring leap years
  uint256 internal constant SECONDS_PER_YEAR = 365 days;

  /**
   * @dev Function to calculate the interest accumulated using a linear interest rate formula
   * it calculates the growth factor for amount which includes principal
   * @param rate The interest rate, in ray
   * @param lastUpdateTimestamp The timestamp of the last update of the interest
   * @return The interest rate linearly accumulated during the timeDelta, in ray
   **/

  function calculateLinearInterest(uint256 rate, uint40 lastUpdateTimestamp)
    internal
    view
    returns (uint256)
  {
    uint256 timeDifference = block.timestamp - lastUpdateTimestamp;
    return ((rate * timeDifference) / SECONDS_PER_YEAR) + WadRayMath.RAY;
  }

 /**
   * @dev Function to calculate the interest using a compounded interest rate formula
   * 
   * Compount Interest = (1 + rate / secondsPerYear) ^ timeElapsed
   * 
   * To avoid expensive exponentiation, the calculation is performed using a binomial approximation:
   *  (1+x)^n = 1+ n*x + [(n*(n-1))/2]*x^2+[(n*(n-1)*(n-2))/6]*x^3...
   * n is timeElapsed and x is rate/secondsPerYear
   * Aave uses: upto three terms is taken
   * The approximation slightly underpays liquidity providers and undercharges borrowers, with the advantage of great gas cost reductions
   * The whitepaper contains reference to the approximation and a table showing the margin of error per different time periods
   *
   * it calculates the growth factor for amount which includes principal
   * @param rate The interest rate, in ray
   * @param lastUpdateTimestamp The timestamp of the last update of the interest
   * @return The interest rate compounded during the timeDelta, in ray
   **/
    function calculateCompoundedInterest(uint256 rate, uint40 lastUpdateTimestamp)
        internal
        view
        returns (uint256)
        {
            uint256 delta = block.timestamp - lastUpdateTimestamp;
            if (delta == 0) {
            return WadRayMath.RAY;
            }
            
            uint256 ratePerSecond = rate / SECONDS_PER_YEAR;

            uint256 basePowerTwo = ratePerSecond.rayMul(ratePerSecond);
            uint256 basePowerThree = basePowerTwo.rayMul(ratePerSecond);
            uint256 deltaMinusOne = delta - 1;
            uint256 deltaMinusTwo = delta > 2 ? delta - 2 : 0;
            uint256 secondTerm = (delta * deltaMinusOne * basePowerTwo) / 2;
            uint256 thirdTerm = (delta * deltaMinusOne * deltaMinusTwo * basePowerThree) / 6;
            return WadRayMath.RAY + (ratePerSecond * delta) + secondTerm + thirdTerm;
        }
    }
