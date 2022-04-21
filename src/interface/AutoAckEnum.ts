export enum AutoAckEnum {
    /**
     * Positive acknowledge in case of success or failure
     */
    ALWAYS_ACK = 'ALWAYS_ACK',
    /**
     * Automatic ack in case of success and automatic nack in case of error
     */
    ACK_AND_NACK = 'ACK_AND_NACK',
    /**
     * Acknowledge should be performed manually
     */
    NEVER = 'NEVER',
    /**
     * Return message to the end of the origin queue
     */
    AUTO_RETRY = 'AUTO_RETRY',
}
