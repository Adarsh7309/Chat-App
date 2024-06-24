import { createContext, useCallback, useEffect, useState } from "react";
import { baseUrl, getRequest, postRequest } from "../utils/services";
import {Socket, io} from "socket.io-client";

export const ChatContext = createContext();

export const ChatContextProvider = ({children, user}) => {
    const [userChats, setUserChats] = useState(null);
    const [isUserChatsLoading, setIsUserChatsLoading] = useState(false);
    const [userChatsError, setUserChatsError] = useState(null);
    const [potentialChats, setPotentialChats] = useState([]);
    const [currentChat, setCurrentChat] = useState(null);
    const[messages, setMessages] = useState(null);
    const[isMessageLoading, setIsMessageLoading] = useState(false);
    const[messagesError, setMessagesError] = useState(null);
    const[sendTextMessageError, setSendTextMessageError] = useState(null);
    const[newMessage, setNewMessage] = useState(null);
    const[socket, setSocket] = useState(null);
    const[onlineUsers, setOnlineUsers] = useState([]);
    const[notifications, setNotifications] = useState([]);
    const[allUsers, setAllUsers] = useState([]);


    console.log("notifications", notifications);
    


    //initial socket

    useEffect(() => {
        const newSocket = io("http://localhost:3000");
        setSocket(newSocket);

        return () => {
            newSocket.disconnect()
        }
    }, [user]);

    //add online users

    useEffect(() => {
       if(socket === null) return 
       socket.emit("addNewUser", user?._id);
       socket.on("getOnlineUsers", (res)=> {
         setOnlineUsers(res);
       })
    }, [socket]);

    // send message
      useEffect(() => {
       if(socket === null) return 
       
       const recipientId = currentChat?.members.find((id) => id !==user?._id);

       socket.emit("sendMessage", {...newMessage, recipientId})

    }, [newMessage]);


     // receive message and notification

     useEffect(() => {
       if(socket === null) return; 
       
       socket.on("getMessage", res=>{
         if(currentChat?._id !== res.chatId) return

         setMessages((prev) => [...prev, res])
       });

       socket.on("getNotification", (res) => {
         const isChatOpened = currentChat?.members.some(id => id === res.senderId)

         if(isChatOpened) {
            setNotifications((prev) => [{...res, isRead:true}, ...prev])
         }else{
            setNotifications(prev => [res, ...prev])
         }
       })

       return () => {
        socket.off("getMessage");
        socket.off("getNotifications");
       }

    }, [socket, currentChat]);



    useEffect(() => {

        const getUsers = async() => {
            const response = await getRequest(`${baseUrl}/users`);
             if(response.error) {
                return console.log("Error fetching usres", response)
             }

             const pChats = response.filter((u) => {
               let isChatCreated = false;

               if (user?._id === u._id) return false;

            if(userChats) {
              isChatCreated = userChats?.some((chat)=> {
                    return chat.members[0] === u._id || chat.members[1] === u._id
                }); 
            }

            return !isChatCreated

            });
          setPotentialChats(pChats);
          setAllUsers(response);
        };

        getUsers()

    }, [userChats]);



    useEffect(() =>{ 
        const getUserChats =  async() =>  {
         if(user?._id) {

            setIsUserChatsLoading(true);
            setUserChatsError(null);

            const response = await getRequest(`${baseUrl}/chats/${user?._id}`);

            setIsUserChatsLoading(false);

            if(response.error) {
                return setUserChatsError(response)
            }

            setUserChats(response);
         }
         
        }

        getUserChats();
    }, [user, notifications]);


    useEffect(() =>{ 
        const getMessages =  async() =>  {

            setIsMessageLoading(true);
            setMessagesError(null);

            const response = await getRequest(`${baseUrl}/messages/${currentChat?._id}`);

            setIsMessageLoading(false);

            if(response.error) {
                return setMessagesError(response)
            }

            setMessages(response);
         }
         
        

        getMessages();
    }, [currentChat]);

    const sendTextMessage = useCallback(async(textMessage, sender, currentChatId, setTextMessage) => {
         if(!textMessage) console.log("Type something to start a conversation..")

            const response = await postRequest(`${baseUrl}/messages`, JSON.stringify({
                chatId: currentChatId,
                senderId: sender._id,
                text: textMessage
            }));

            if(response.error) {
                return setSendTextMessageError(response)
            }

            setNewMessage(response);
            setMessages((prev) => [...prev, response]);
            setTextMessage(" ");
            
    }, [])

    const updateCurrentChat = useCallback((chat)=>{
          setCurrentChat(chat);
    }, [])

    const createChat = useCallback(async(firstId, secondId) => {
         const response = await postRequest(`${baseUrl}/chats`, JSON.stringify({firstId, secondId}));

         if(response.error) {
            return console.log("Error creating Chat", response)
         }

         setUserChats((prev) => [...prev, response]);
    }, [])

    const markAllNotificationsAsRead = useCallback((notifications) => {
        const mNotifications = notifications.map(n => {return {...n, isRead:true}});

        setNotifications(mNotifications);
    },[]);

    const markNotificationsAsRead = useCallback((n, userChats, user, notifications ) => {
           // find chat to open

           const desiredChat = userChats.find(chat => {
            const chatMembers = [user._id, n.senderId];
            const isDesiredChat = chat?.members.every((member) => {
                return chatMembers.includes(member);
            } )
            return isDesiredChat;
           })

           //mark chat as read 

           const mNotifications = notifications.map(el => {
            if(n.senderId === el.senderId) {
                return {...n, isRead: true}
            } else {
                return el
            }
           })

           updateCurrentChat(desiredChat);
           setNotifications(mNotifications);
    }, []);

    const markThisUserNotificationsAsRead = useCallback((thisUserNotifications, notifications) => {
           // mark notifications as read

           const mNotifications = notifications.map(el => {
            let notification; 
            thisUserNotifications.forEach(n => {
                if(n.senderId === el.senderId) {
                   notification = {...n, isRead:true}
                }else{
                    notification = el
                }
            })
               return notification
           })
           setNotifications(mNotifications)
    }, [])

    return <ChatContext.Provider value={{userChats, isUserChatsLoading, userChatsError, potentialChats, createChat, currentChat, updateCurrentChat, messages, isMessageLoading, messagesError, sendTextMessage, onlineUsers, notifications, allUsers, markAllNotificationsAsRead, markNotificationsAsRead, markThisUserNotificationsAsRead }}>{children}</ChatContext.Provider>
    
} ;
