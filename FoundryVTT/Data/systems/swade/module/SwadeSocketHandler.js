export default class SwadeSocketHandler {
    constructor() {
        this.SWADE = 'system.swade';
        //register socket listeners
        this.registerSocketListeners();
    }
    /**
     * registers all the socket listeners
     */
    registerSocketListeners() {
        game.socket?.on('system.swade', async (data) => {
            switch (data.type) {
                case 'deleteConvictionMessage':
                    await this._onDeleteConvictionMessage(data);
                    break;
                case 'newRound':
                    this._onNewRound(data);
                    break;
                default:
                    this._onUnknownSocket();
                    break;
            }
        });
    }
    deleteConvictionMessage(messageId) {
        game.socket?.emit(this.SWADE, {
            type: 'deleteConvictionMessage',
            messageId,
            userId: game.userId,
        });
    }
    _onDeleteConvictionMessage(data) {
        const message = game.messages?.get(data.messageId);
        //only delete the message if the user is a GM and the event emitter is one of the recipients
        if (game.user.isGM && message.data['whisper'].includes(data.userId)) {
            message.delete();
        }
    }
    async _onNewRound(data) {
        //return early if the user is not the first active GM sorted by ID
        const activeGMs = game
            .users.filter((u) => u.isGM && u.active)
            .sort((a, b) => a.id.localeCompare(b.id));
        if (activeGMs[0]?.id !== game.user.id)
            return;
        //advance round
        game.combats.get(data.combatId).nextRound();
    }
    _onUnknownSocket() {
        console.warn(new Error('This socket event is not supported'));
    }
}
