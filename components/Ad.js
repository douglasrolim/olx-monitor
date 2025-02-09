'use strict';

const path = require( 'path' )
const config = require( '../config' )
const notifier = require( './Notifier' )
const log = require('simple-node-logger').createSimpleLogger( path.join( __dirname, '../', config.logFile ) )
const adRepository = require('../repositories/adRepositorie.js')

class Ad{
    
    constructor( ad ){
        this.id               = ad.id
        this.url              = ad.url
        this.title            = ad.title
        this.searchTerm       = ad.searchTerm
        this.price            = ad.price
        this.valid            = false
        this.saved            = null,
        this.notify           = ad.notify
    }

    process = async () => {

        if ( !this.isValidAd() ) {
            log.debug( 'Ad not valid' );
            return false
        }

        try{

            // check if this entry was already added to DB
            if( await this.alreadySaved() ){
                return this.checkPriceChange()
            }
    
            else{
                // create a new entry in the database
                return this.addToDataBase()
            }
    
        } catch( error ){
            log.error( error );
        }
    }

    alreadySaved = async () => {
        try {
            this.saved = await adRepository.getAd(this.id)
            return true
        } catch ( error ) {
            return false
        }
    }

    addToDataBase = async () => {
        
        try {
            await adRepository.createAd(this)

             // because in the first run all the ads are new
            if( this.notify ){

                try {
                    const msg = 'New ad found!\n' + this.title + ' - R$' + this.price + '\n\n' + this.url
                    log.info('Ad ' + this.id + ' added to the database')
                    await notifier.sendNotification( msg )
                } catch (error) {
                    log.error('Could not send a notification')
                }
            }
        }
    
        catch ( error )  {
            log.error( error )
        }
    }

    updatePrice = async () => {
        log.info( 'updatePrice' )

        try {
            await adRepository.updateAd(this)
        } catch ( error ) {
            log.error( error )
        }
    }

    checkPriceChange = async () => {

        if( this.price !== this.saved.price ){
    
            await this.updatePrice(this)
    
            // just send a notification if the price dropped
            if( this.price < this.saved.price ){

                log.info('This ad had a price reduction: ' + this.url )

                const decreasePercentage = Math.abs( Math.round( ( ( this.price - this.saved.price ) / this.saved.price ) * 100 ) )

                const msg = 'Price drop found! '+ decreasePercentage +'% OFF!\n' + 
                'From R$' + this.saved.price + ' to R$' + this.price + '\n\n' + this.url

                await notifier.sendNotification( msg )
            }
        }
    }


    // some elements found in the ads selection don't have an url
    // I supposed that OLX adds other content between the ads,
    // let's clean those empty ads
    isValidAd = () => {

        if ( !isNaN(this.price) && this.url && this.id ){
            this.valid = true
            return true
        }
        else{
            this.valid = false
            return false
        }
    }
}

module.exports = Ad