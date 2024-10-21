using System.Collections.Concurrent;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
namespace aibotPro.Service
{
    public class ChatCancellationManager
    {
        private readonly ConcurrentDictionary<string, Tuple<SemaphoreSlim, CancellationTokenSource>> _cancellationTokens;

        public ChatCancellationManager()
        {
            _cancellationTokens = new ConcurrentDictionary<string, Tuple<SemaphoreSlim, CancellationTokenSource>>();
        }

        public (SemaphoreSlim semaphore, CancellationToken cancellationToken) GetOrCreateToken(string chatId)
        {
            var semaphore = new SemaphoreSlim(1, 1);
            var cancellationTokenSource = new CancellationTokenSource();
            var tokenTuple = new Tuple<SemaphoreSlim, CancellationTokenSource>(semaphore, cancellationTokenSource);

            var added = _cancellationTokens.GetOrAdd(chatId, tokenTuple);
            return (added.Item1, added.Item2.Token);
        }

        public bool TryCancelChat(string chatId)
        {
            if (_cancellationTokens.TryGetValue(chatId, out var tokenTuple))
            {
                tokenTuple.Item2.Cancel();
                return true;
            }
            return false;
        }

        public void RemoveToken(string chatId)
        {
            if (_cancellationTokens.TryRemove(chatId, out var tokenTuple))
            {
                tokenTuple.Item1.Dispose();
                tokenTuple.Item2.Dispose();
            }
        }
    }
}
